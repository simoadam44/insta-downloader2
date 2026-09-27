import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project.)

// ---------- security (inlined) ----------
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

// ---------- admin token verify (inlined; mirrors server.ts) ----------
// Client-fabricated "fallback_admin_token_*" strings are NEVER valid here.
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

// ---------- supabase admin client (inlined) ----------
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

let adminClient: SupabaseClient | null | undefined;

function getSupabaseUrl(): string {
  // Manual setup uses SUPABASE_URL; the native Supabase↔Vercel integration
  // syncs it as NEXT_PUBLIC_SUPABASE_URL. Accept both.
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getSupabaseServiceKey(): string {
  // Manual setup uses SUPABASE_SERVICE_ROLE_KEY; the native Supabase↔Vercel
  // integration syncs the new-format key as SUPABASE_SECRET_KEY. Accept both.
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
  adminClient = createClient(
    getSupabaseUrl(),
    getSupabaseServiceKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return adminClient;
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

// ---------- handler ----------
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
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Keyword database not configured.', supabase: false });

  try {
    if (req.method === 'GET') {
      const all = req.query.all === '1';
      if (all) {
        const auth = verifyAdminToken(req.headers.authorization);
        if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      }
      let q = sb.from('keyword_pages').select('*').order('created_at', { ascending: true });
      if (!all) q = q.eq('enabled', true);
      const { data, error } = await q;
      if (error || !data) return res.status(500).json({ error: 'Failed to load keyword pages.' });
      return res.status(200).json({ pages: data.map(rowToPage) });
    }

    if (req.method === 'POST') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const body = (req.body || {}) as any;
      const str = (v: any, max: number): string =>
        typeof v === 'string' ? v.substring(0, max) : '';
      const page: KeywordToolPage = {
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
      const { error } = await sb.from('keyword_pages').upsert(pageToRow(page), { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to save keyword page.' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const id = req.query.id as string;
      if (!id || typeof id !== 'string' || id.length > 80) {
        return res.status(400).json({ error: 'Valid id is required.' });
      }
      const { error } = await sb.from('keyword_pages').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to delete keyword page.' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Keyword API error.' });
  }
}
