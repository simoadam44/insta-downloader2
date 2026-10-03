import { CfContext, checkRateLimit, getEnv, json, unauthorized, verifyAdminToken } from '../_lib/cf';
import { getSbConfig, sbDelete, sbList, sbUpsert } from '../_lib/supabase';

// Keyword pages API (Supabase-backed, public to all visitors).
//   GET    /api/keyword-pages            -> enabled pages (public)
//   GET    /api/keyword-pages?all=1      -> all pages (admin Bearer required)
//   POST   /api/keyword-pages            -> upsert page (admin Bearer required)
//   DELETE /api/keyword-pages?id=xxx     -> delete page (admin Bearer required)
interface KeywordToolPage {
  id: string;
  slug: string;
  badge: string;
  targetKeyword: string;
  lang: string;
  tool: string;
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  enabled: boolean;
}

function rowToPage(r: any): KeywordToolPage {
  return {
    id: r.id,
    slug: r.slug,
    badge: r.badge || '',
    targetKeyword: r.target_keyword || '',
    lang: r.lang || 'en',
    tool: r.tool || 'video',
    title: r.title || '',
    metaDescription: r.meta_description || '',
    h1: r.h1 || '',
    subtitle: r.subtitle || '',
    enabled: r.enabled !== false,
  };
}

function pageToRow(p: KeywordToolPage): Record<string, any> {
  return {
    id: p.id,
    slug: p.slug,
    badge: p.badge || '',
    target_keyword: p.targetKeyword || '',
    lang: p.lang || 'en',
    tool: p.tool || 'video',
    title: p.title || '',
    meta_description: p.metaDescription || '',
    h1: p.h1 || '',
    subtitle: p.subtitle || '',
    enabled: p.enabled !== false,
  };
}

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const noStore = { 'Cache-Control': 'no-store' };
  if (checkRateLimit(request, 'keywords', 120, 60 * 1000)) {
    return json({ error: 'Too many requests. Please wait a minute.' }, 429, noStore);
  }

  const cfg = getSbConfig(env);
  if (!cfg) {
    return json({ error: 'Keyword database not configured.', supabase: false }, 503, noStore);
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
        data = await sbList(cfg, 'keyword_pages', { select: '*', eq, order: 'created_at.asc' });
      } catch (e: any) {
        // Safe detail only (PostgREST code/message — never keys). Tells whether
        // the URL is wrong, the key is invalid (401), or the table is missing.
        return json({ error: 'Failed to load keyword pages.', detail: String(e?.message || e).substring(0, 160) }, 500, noStore);
      }
      return json(
        { pages: data.map(rowToPage) },
        200,
        { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
      );
    }

    if (request.method === 'POST') {
      const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
      if (!auth.valid) return unauthorized();
      const body = (await request.json().catch(() => null)) as any;
      const str = (v: any, max: number): string => (typeof v === 'string' ? v.substring(0, max) : '');
      const page: KeywordToolPage = {
        id: str(body?.id, 80),
        slug: str(body?.slug, 120),
        badge: str(body?.badge, 60),
        targetKeyword: str(body?.targetKeyword, 160),
        lang: ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body?.lang) ? body.lang : 'en',
        tool: ['video', 'photo', 'reels', 'story', 'highlights'].includes(body?.tool) ? body.tool : 'video',
        title: str(body?.title, 200),
        metaDescription: str(body?.metaDescription, 400),
        h1: str(body?.h1, 160),
        subtitle: str(body?.subtitle, 300),
        enabled: body?.enabled !== false,
      };
      if (!page.id || !page.slug || !page.targetKeyword || !page.title || !page.h1) {
        return json({ error: 'id, slug, targetKeyword, title and h1 are required.' }, 400, noStore);
      }
      try {
        await sbUpsert(cfg, 'keyword_pages', pageToRow(page), 'id');
      } catch {
        return json({ error: 'Failed to save keyword page.' }, 500, noStore);
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
        await sbDelete(cfg, 'keyword_pages', { id });
      } catch {
        return json({ error: 'Failed to delete keyword page.' }, 500, noStore);
      }
      return json({ success: true }, 200, noStore);
    }

    return json({ error: 'Method not allowed.' }, 405, noStore);
  } catch (e: any) {
    return json({ error: e?.message || 'Keyword API error.' }, 500, noStore);
  }
}
