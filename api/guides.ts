import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SELF-CONTAINED Vercel function — zero local-file imports.
// Guide articles API (Supabase-backed blog engine).
//   GET    /api/guides            -> enabled guides (public)
//   GET    /api/guides?all=1      -> all guides (admin Bearer required)
//   POST   /api/guides            -> upsert guide (admin Bearer required)
//   DELETE /api/guides?id=xxx     -> delete guide (admin Bearer required)

function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

const buckets = new Map<string, { count: number; reset: number }>();

function checkRateLimit(req: VercelRequest, scope: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  const ip = ((first || (req.headers['x-real-ip'] as string) || 'unknown').trim() || 'unknown').substring(0, 45);
  const key = `${scope}:${ip}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

function verifyAdminToken(authHeader: string | undefined): { valid: boolean; user?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.substring(7);
  if (!token || token.length > 512) return { valid: false };
  try {
    const secret = process.env.SESSION_SECRET || '';
    if (!secret) return { valid: false };
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const sep1 = decoded.indexOf(':');
    const sep2 = decoded.lastIndexOf(':');
    if (sep1 <= 0 || sep2 <= sep1) return { valid: false };
    const user = decoded.substring(0, sep1);
    const timestampStr = decoded.substring(sep1 + 1, sep2);
    const signature = decoded.substring(sep2 + 1);
    if (!user || user.length > 50) return { valid: false };
    const timestamp = Number(timestampStr);
    if (!timestamp || isNaN(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      return { valid: false };
    }
    const expectedSig = crypto.createHmac('sha256', secret).update(`${user}:${timestampStr}`).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };
    return { valid: true, user };
  } catch {}
  return { valid: false };
}

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

let adminClient: SupabaseClient | null | undefined;

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}
function getSupabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
}
function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseServiceKey());
}
function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  if (!isSupabaseConfigured()) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (checkRateLimit(req, 'guides', 120, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Guides database not configured.', supabase: false });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Guides database not configured.', supabase: false });

  try {
    if (req.method === 'GET') {
      const all = req.query.all === '1';
      if (all) {
        const auth = verifyAdminToken(req.headers.authorization);
        if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      }
      let q = sb.from('guide_articles').select('*').order('created_at', { ascending: true });
      if (!all) q = q.eq('enabled', true);
      const { data, error } = await q;
      if (error || !data) return res.status(500).json({ error: 'Failed to load guides.' });
      return res.status(200).json({ guides: data.map(rowToGuide) });
    }

    if (req.method === 'POST') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const body = (req.body || {}) as any;
      const str = (v: any, max: number): string =>
        typeof v === 'string' ? v.substring(0, max) : '';
      const guide: GuideArticle = {
        id: str(body.id, 80),
        slug: str(body.slug, 160),
        lang: ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body.lang) ? body.lang : 'en',
        keyword: str(body.keyword, 200),
        tool: ['video', 'photo', 'reels', 'story', 'highlights'].includes(body.tool) ? body.tool : 'video',
        title: str(body.title, 200),
        metaDescription: str(body.metaDescription, 400),
        h1: str(body.h1, 200),
        excerpt: str(body.excerpt, 400),
        sections: asSectionArray(body.sections),
        faqs: asFaqArray(body.faqs),
        relatedSlugs: Array.isArray(body.relatedSlugs)
          ? body.relatedSlugs.filter((s: any) => typeof s === 'string').map((s: string) => s.substring(0, 160)).slice(0, 10)
          : [],
        enabled: body.enabled !== false,
      };
      if (!guide.id || !guide.slug || !guide.title || !guide.h1) {
        return res.status(400).json({ error: 'id, slug, title and h1 are required.' });
      }
      const { error } = await sb.from('guide_articles').upsert(guideToRow(guide), { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to save guide.' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const id = req.query.id as string;
      if (!id || typeof id !== 'string' || id.length > 80) {
        return res.status(400).json({ error: 'Valid id is required.' });
      }
      const { error } = await sb.from('guide_articles').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to delete guide.' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Guides API error.' });
  }
}
