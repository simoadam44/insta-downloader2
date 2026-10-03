import { CfContext, checkRateLimit, getEnv, json, unauthorized, verifyAdminToken } from '../_lib/cf';
import { getSbConfig, sbDelete, sbList, sbUpsert } from '../_lib/supabase';

// Guide articles API (Supabase-backed blog engine).
//   GET    /api/guides            -> enabled guides (public)
//   GET    /api/guides?all=1      -> all guides (admin Bearer required)
//   POST   /api/guides            -> upsert guide (admin Bearer required)
//   DELETE /api/guides?id=xxx     -> delete guide (admin Bearer required)
interface GuideSection {
  heading: string;
  body: string;
}
interface GuideFaq {
  question: string;
  answer: string;
}
interface GuideArticle {
  id: string;
  slug: string;
  lang: string;
  keyword: string;
  tool: string;
  title: string;
  metaDescription: string;
  h1: string;
  excerpt: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  relatedSlugs: string[];
  enabled: boolean;
  updatedAt?: string;
}

function asSectionArray(v: any): GuideSection[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({ heading: String(s.heading || '').substring(0, 200), body: String(s.body || '').substring(0, 4000) }))
    .filter((s) => s.heading || s.body)
    .slice(0, 20);
}
function asFaqArray(v: any): GuideFaq[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({ question: String(f.question || '').substring(0, 300), answer: String(f.answer || '').substring(0, 2000) }))
    .filter((f) => f.question && f.answer)
    .slice(0, 20);
}
function rowToGuide(r: any): GuideArticle {
  return {
    id: r.id,
    slug: r.slug,
    lang: r.lang || 'en',
    keyword: r.keyword || '',
    tool: r.tool || 'video',
    title: r.title || '',
    metaDescription: r.meta_description || '',
    h1: r.h1 || '',
    excerpt: r.excerpt || '',
    sections: asSectionArray(r.sections),
    faqs: asFaqArray(r.faqs),
    relatedSlugs: Array.isArray(r.related_slugs) ? r.related_slugs.filter((s: any) => typeof s === 'string').slice(0, 10) : [],
    enabled: r.enabled !== false,
    updatedAt: r.updated_at || undefined,
  };
}
function guideToRow(g: GuideArticle): Record<string, any> {
  return {
    id: g.id,
    slug: g.slug,
    lang: g.lang,
    keyword: g.keyword,
    tool: g.tool,
    title: g.title,
    meta_description: g.metaDescription,
    h1: g.h1,
    excerpt: g.excerpt,
    sections: g.sections,
    faqs: g.faqs,
    related_slugs: g.relatedSlugs,
    enabled: g.enabled !== false,
  };
}

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const noStore = { 'Cache-Control': 'no-store' };
  if (checkRateLimit(request, 'guides', 120, 60 * 1000)) {
    return json({ error: 'Too many requests. Please wait a minute.' }, 429, noStore);
  }

  const cfg = getSbConfig(env);
  if (!cfg) {
    return json({ error: 'Guides database not configured.', supabase: false }, 503, noStore);
  }
  const secret = getEnv(env, 'SESSION_SECRET');
  const q = new URL(request.url).searchParams;

  try {
    if (request.method === 'GET') {
      const all = q.get('all') === '1';
      if (all) {
        const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
        if (!auth.valid) return unauthorized();
      }
      const eq: Record<string, string | boolean> = {};
      if (!all) eq.enabled = true;
      let data: any[];
      try {
        data = await sbList(cfg, 'guide_articles', { select: '*', eq, order: 'created_at.asc' });
      } catch {
        return json({ error: 'Failed to load guides.' }, 500, noStore);
      }
      return json(
        { guides: data.map(rowToGuide) },
        200,
        { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
      );
    }

    if (request.method === 'POST') {
      const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
      if (!auth.valid) return unauthorized();
      const body = (await request.json().catch(() => null)) as any;
      const str = (v: any, max: number): string => (typeof v === 'string' ? v.substring(0, max) : '');
      const guide: GuideArticle = {
        id: str(body?.id, 80),
        slug: str(body?.slug, 160),
        lang: ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body?.lang) ? body.lang : 'en',
        keyword: str(body?.keyword, 200),
        tool: ['video', 'photo', 'reels', 'story', 'highlights'].includes(body?.tool) ? body.tool : 'video',
        title: str(body?.title, 200),
        metaDescription: str(body?.metaDescription, 400),
        h1: str(body?.h1, 200),
        excerpt: str(body?.excerpt, 400),
        sections: asSectionArray(body?.sections),
        faqs: asFaqArray(body?.faqs),
        relatedSlugs: Array.isArray(body?.relatedSlugs)
          ? body.relatedSlugs.filter((s: any) => typeof s === 'string').map((s: string) => s.substring(0, 160)).slice(0, 10)
          : [],
        enabled: body?.enabled !== false,
      };
      if (!guide.id || !guide.slug || !guide.title || !guide.h1) {
        return json({ error: 'id, slug, title and h1 are required.' }, 400, noStore);
      }
      try {
        await sbUpsert(cfg, 'guide_articles', guideToRow(guide), 'id');
      } catch {
        return json({ error: 'Failed to save guide.' }, 500, noStore);
      }
      return json({ success: true }, 200, noStore);
    }

    if (request.method === 'DELETE') {
      const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
      if (!auth.valid) return unauthorized();
      const id = q.get('id') || '';
      if (!id || id.length > 80) {
        return json({ error: 'Valid id is required.' }, 400, noStore);
      }
      try {
        await sbDelete(cfg, 'guide_articles', { id });
      } catch {
        return json({ error: 'Failed to delete guide.' }, 500, noStore);
      }
      return json({ success: true }, 200, noStore);
    }

    return json({ error: 'Method not allowed.' }, 405, noStore);
  } catch (e: any) {
    return json({ error: e?.message || 'Guides API error.' }, 500, noStore);
  }
}
