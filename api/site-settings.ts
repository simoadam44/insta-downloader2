import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SELF-CONTAINED Vercel function — zero local-file imports.
// Shared dashboard settings (singleton row id='global').
//   GET    /api/site-settings  -> public read (visitors + admin)
//   PUT    /api/site-settings  -> admin Bearer required (partial merge)
//   POST   /api/site-settings  -> alias of PUT (admin Bearer required)

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

const str = (v: any, max: number): string =>
  typeof v === 'string' ? v.substring(0, max) : '';
const num = (v: any, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const bool = (v: any, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;
const strArr = (v: any, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v)
    ? v.filter((s) => typeof s === 'string').map((s: string) => s.substring(0, maxLen)).slice(0, maxItems)
    : [];

function cleanAdSlot(v: any): Record<string, any> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  return {
    enabled: bool(v.enabled, false),
    type: ['banner', 'native', 'script', 'adsense'].includes(v.type) ? v.type : 'banner',
    title: str(v.title, 120),
    adClient: str(v.adClient, 60),
    adSlot: str(v.adSlot, 40),
    customHtml: str(v.customHtml, 20000),
  };
}

function sanitizePartial(body: any): Record<string, any> {
  const partial: Record<string, any> = {};
  if (body.branding && typeof body.branding === 'object') {
    const b = body.branding;
    partial.branding = {
      siteName: str(b.siteName, 80),
      siteTagline: str(b.siteTagline, 160),
      logoType: ['default', 'image', 'text'].includes(b.logoType) ? b.logoType : 'default',
      customLogoUrl: str(b.customLogoUrl, 500),
      faviconUrl: str(b.faviconUrl, 500),
      accentColor: str(b.accentColor, 20),
      contactEmail: str(b.contactEmail, 120),
      copyrightText: str(b.copyrightText, 300),
    };
  }
  if (body.seoTracking && typeof body.seoTracking === 'object') {
    const s = body.seoTracking;
    partial.seoTracking = {
      googleAnalyticsId: str(s.googleAnalyticsId, 30),
      googleSearchConsoleCode: str(s.googleSearchConsoleCode, 2000),
      bingWebmasterCode: str(s.bingWebmasterCode, 2000),
      facebookPixelId: str(s.facebookPixelId, 40),
      customHeadCode: str(s.customHeadCode, 20000),
      customBodyCode: str(s.customBodyCode, 20000),
      enableRobotsIndex: bool(s.enableRobotsIndex, true),
      canonicalBaseUrl: str(s.canonicalBaseUrl, 200),
    };
  }
  if (body.ads && typeof body.ads === 'object') {
    const a = body.ads;
    const cleaned: Record<string, any> = {
      autoAdsEnabled: bool(a.autoAdsEnabled, false),
      autoAdsClientId: str(a.autoAdsClientId, 60),
      customPopunderCode: str(a.customPopunderCode, 20000),
    };
    for (const slot of ['headerBanner', 'belowInput', 'aboveResult', 'inContentBanner', 'footerBanner', 'stickyFooterBanner']) {
      const c = cleanAdSlot(a[slot]);
      if (c) cleaned[slot] = c;
    }
    partial.ads = cleaned;
  }
  if (body.api && typeof body.api === 'object') {
    const p = body.api;
    partial.api = {
      primaryEndpoint: str(p.primaryEndpoint, 200),
      backupEndpoint: str(p.backupEndpoint, 200),
      rapidApiKey: str(p.rapidApiKey, 200),
      timeoutMs: num(p.timeoutMs, 15000, 1000, 60000),
      rateLimitPerMin: num(p.rateLimitPerMin, 50, 1, 1000),
      enableRotatingProxies: bool(p.enableRotatingProxies, false),
      proxyPool: strArr(p.proxyPool, 20, 300),
    };
  }
  if (body.seoOverrides && typeof body.seoOverrides === 'object') {
    const entries = Object.entries(body.seoOverrides).slice(0, 120);
    const cleaned: Record<string, any> = {};
    for (const [k, v] of entries) {
      if (typeof k !== 'string' || k.length > 80 || !v || typeof v !== 'object') continue;
      const c: any = v;
      cleaned[k.substring(0, 80)] = {
        title: str(c.title, 200),
        metaDescription: str(c.metaDescription, 400),
        h1: str(c.h1, 200),
        subtitle: str(c.subtitle, 300),
        badge: str(c.badge, 60),
        canonicalPath: str(c.canonicalPath, 200),
        features: Array.isArray(c.features)
          ? c.features.slice(0, 12).map((f: any) => ({
              title: str(f?.title, 120),
              description: str(f?.description, 400),
              icon: str(f?.icon, 40),
            }))
          : [],
        steps: Array.isArray(c.steps)
          ? c.steps.slice(0, 12).map((s: any, i: number) => ({
              step: num(s?.step, i + 1, 1, 99),
              title: str(s?.title, 120),
              description: str(s?.description, 400),
            }))
          : [],
        faqs: Array.isArray(c.faqs)
          ? c.faqs.slice(0, 20).map((f: any) => ({
              question: str(f?.question, 300),
              answer: str(f?.answer, 2000),
            }))
          : [],
      };
    }
    partial.seoOverrides = cleaned;
  }
  return partial;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (checkRateLimit(req, 'site-settings', 120, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Settings database not configured.', supabase: false });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Settings database not configured.', supabase: false });

  try {
    if (req.method === 'GET') {
      // Short edge cache on purpose: admin saves must be visible in other
      // browsers within seconds, not minutes. Payload is tiny JSON.
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      const { data, error } = await sb
        .from('site_settings')
        .select('branding, seo_tracking, ads, api, seo_overrides')
        .eq('id', 'global')
        .maybeSingle();
      if (error || !data) {
        // Safe detail only (PostgREST code/message — never keys). A missing
        // table surfaces here as e.g. "42P01: relation ... does not exist".
        const detail = error ? `${error.code || 'ERR'}: ${String(error.message || '').substring(0, 160)}` : 'empty row';
        return res.status(500).json({ error: 'Failed to load site settings.', detail });
      }
      return res.status(200).json({
        settings: {
          branding: data.branding && typeof data.branding === 'object' ? data.branding : {},
          seoTracking: data.seo_tracking && typeof data.seo_tracking === 'object' ? data.seo_tracking : {},
          ads: data.ads && typeof data.ads === 'object' ? data.ads : {},
          api: data.api && typeof data.api === 'object' ? data.api : {},
          seoOverrides: data.seo_overrides && typeof data.seo_overrides === 'object' ? data.seo_overrides : {},
        },
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const auth = verifyAdminToken(req.headers.authorization);
      if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
      const partial = sanitizePartial(req.body || {});
      if (Object.keys(partial).length === 0) {
        return res.status(400).json({ error: 'No valid settings provided.' });
      }
      // Merge over stored row so partial writes never wipe other sections.
      const { data: current } = await sb
        .from('site_settings')
        .select('branding, seo_tracking, ads, api, seo_overrides')
        .eq('id', 'global')
        .maybeSingle();
      const row: Record<string, any> = { id: 'global' };
      if (partial.branding !== undefined) row.branding = { ...(current?.branding || {}), ...partial.branding };
      if (partial.seoTracking !== undefined) row.seo_tracking = { ...(current?.seo_tracking || {}), ...partial.seoTracking };
      if (partial.ads !== undefined) row.ads = { ...(current?.ads || {}), ...partial.ads };
      if (partial.api !== undefined) row.api = { ...(current?.api || {}), ...partial.api };
      if (partial.seoOverrides !== undefined) row.seo_overrides = { ...(current?.seo_overrides || {}), ...partial.seoOverrides };
      const { error } = await sb.from('site_settings').upsert(row, { onConflict: 'id' });
      if (error) {
        // Safe detail only (never keys). RLS denial (wrong key type, e.g.
        // anon instead of service_role) surfaces here as code 42501.
        const detail = `${error.code || 'ERR'}: ${String(error.message || '').substring(0, 160)}`;
        return res.status(500).json({ error: 'Failed to save site settings.', detail });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Settings API error.' });
  }
}
