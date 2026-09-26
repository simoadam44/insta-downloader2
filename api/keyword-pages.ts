import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminToken } from './_admin';
import { checkRateLimit, setSecurityHeaders } from './_security';
import {
  deleteKeywordPage,
  isSupabaseConfigured,
  listKeywordPages,
  upsertKeywordPage,
} from './_supabase';

// Keyword pages API (Supabase-backed, public to all visitors).
//   GET    /api/keyword-pages            -> enabled pages (public)
//   GET    /api/keyword-pages?all=1      -> all pages (admin Bearer required)
//   POST   /api/keyword-pages            -> upsert page (admin Bearer required)
//   DELETE /api/keyword-pages?id=xxx     -> delete page (admin Bearer required)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (checkRateLimit(req, 'keywords', 120, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Keyword database not configured.', supabase: false });
  }

  try {
    if (req.method === 'GET') {
      const all = req.query.all === '1';
      if (all) {
        const auth = verifyAdminToken(req.headers.authorization);
        if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      }
      const pages = await listKeywordPages(!all);
      if (!pages) return res.status(500).json({ error: 'Failed to load keyword pages.' });
      return res.status(200).json({ pages });
    }

    if (req.method === 'POST') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const body = (req.body || {}) as any;
      // Strict field allowlist + length caps (admin-only, but never trust input).
      const str = (v: any, max: number): string =>
        typeof v === 'string' ? v.substring(0, max) : '';
      const page = {
        id: str(body.id, 80),
        slug: str(body.slug, 120),
        badge: str(body.badge, 60),
        targetKeyword: str(body.targetKeyword, 160),
        lang: ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body.lang) ? body.lang : 'en',
        tool: ['video', 'photo', 'reels', 'story', 'highlights'].includes(body.tool) ? body.tool : 'video',
        title: str(body.title, 200),
        metaDescription: str(body.metaDescription, 400),
        h1: str(body.h1, 160),
        subtitle: str(body.subtitle, 300),
        enabled: body.enabled !== false,
      };
      if (!page.id || !page.slug || !page.targetKeyword || !page.title || !page.h1) {
        return res.status(400).json({ error: 'id, slug, targetKeyword, title and h1 are required.' });
      }
      const ok = await upsertKeywordPage(page);
      if (!ok) return res.status(500).json({ error: 'Failed to save keyword page.' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const id = req.query.id as string;
      if (!id || typeof id !== 'string' || id.length > 80) {
        return res.status(400).json({ error: 'Valid id is required.' });
      }
      const ok = await deleteKeywordPage(id);
      if (!ok) return res.status(500).json({ error: 'Failed to delete keyword page.' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Keyword API error.' });
  }
}
