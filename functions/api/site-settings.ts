import { CfContext, checkRateLimit, getEnv, isSearchCrawler, json, unauthorized, verifyAdminToken } from '../_lib/cf';
import { getSbConfig, sbGetOne, sbUpsert } from '../_lib/supabase';

// Shared dashboard settings (singleton row id='global').
//   GET    /api/site-settings  -> public read (visitors + admin)
//   PUT    /api/site-settings  -> admin Bearer required (partial merge)
//   POST   /api/site-settings  -> alias of PUT (admin Bearer required)
const str = (v: any, max: number): string => (typeof v === 'string' ? v.substring(0, max) : '');
const num = (v: any, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const bool = (v: any, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
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

// TRUE PATCH semantics: only keys PRESENT in the input are written —
// absent keys keep their stored values.
function sanitizePartial(body: any): Record<string, any> {
  const partial: Record<string, any> = {};
  if (body.branding && typeof body.branding === 'object') {
    const b = body.branding;
    const o: Record<string, any> = {};
    if (typeof b.siteName === 'string') o.siteName = b.siteName.substring(0, 80);
    if (typeof b.siteTagline === 'string') o.siteTagline = b.siteTagline.substring(0, 160);
    if (['default', 'image', 'text'].includes(b.logoType)) o.logoType = b.logoType;
    if (typeof b.customLogoUrl === 'string') o.customLogoUrl = b.customLogoUrl.substring(0, 500);
    if (typeof b.faviconUrl === 'string') o.faviconUrl = b.faviconUrl.substring(0, 500);
    if (typeof b.accentColor === 'string') o.accentColor = b.accentColor.substring(0, 20);
    if (typeof b.contactEmail === 'string') o.contactEmail = b.contactEmail.substring(0, 120);
    if (typeof b.copyrightText === 'string') o.copyrightText = b.copyrightText.substring(0, 300);
    if (Object.keys(o).length > 0) partial.branding = o;
  }
  if (body.seoTracking && typeof body.seoTracking === 'object') {
    const s = body.seoTracking;
    const o: Record<string, any> = {};
    if (typeof s.googleAnalyticsId === 'string') o.googleAnalyticsId = s.googleAnalyticsId.substring(0, 30);
    if (typeof s.googleSearchConsoleCode === 'string') o.googleSearchConsoleCode = s.googleSearchConsoleCode.substring(0, 2000);
    if (typeof s.bingWebmasterCode === 'string') o.bingWebmasterCode = s.bingWebmasterCode.substring(0, 2000);
    if (typeof s.facebookPixelId === 'string') o.facebookPixelId = s.facebookPixelId.substring(0, 40);
    if (typeof s.customHeadCode === 'string') o.customHeadCode = s.customHeadCode.substring(0, 20000);
    if (typeof s.customBodyCode === 'string') o.customBodyCode = s.customBodyCode.substring(0, 20000);
    if (typeof s.enableRobotsIndex === 'boolean') o.enableRobotsIndex = s.enableRobotsIndex;
    if (typeof s.canonicalBaseUrl === 'string') o.canonicalBaseUrl = s.canonicalBaseUrl.substring(0, 200);
    if (Object.keys(o).length > 0) partial.seoTracking = o;
  }
  if (body.ads && typeof body.ads === 'object') {
    const a = body.ads;
    const cleaned: Record<string, any> = {};
    if (typeof a.autoAdsEnabled === 'boolean') cleaned.autoAdsEnabled = a.autoAdsEnabled;
    if (typeof a.autoAdsClientId === 'string') cleaned.autoAdsClientId = a.autoAdsClientId.substring(0, 60);
    if (typeof a.customPopunderCode === 'string') cleaned.customPopunderCode = a.customPopunderCode.substring(0, 20000);
    for (const slot of ['headerBanner', 'belowInput', 'aboveResult', 'inContentBanner', 'footerBanner', 'stickyFooterBanner']) {
      const c = cleanAdSlot(a[slot]);
      if (c) cleaned[slot] = c;
    }
    if (Object.keys(cleaned).length > 0) partial.ads = cleaned;
  }
  if (body.api && typeof body.api === 'object') {
    const p = body.api;
    const o: Record<string, any> = {};
    if (typeof p.primaryEndpoint === 'string') o.primaryEndpoint = p.primaryEndpoint.substring(0, 200);
    if (typeof p.backupEndpoint === 'string') o.backupEndpoint = p.backupEndpoint.substring(0, 200);
    if (typeof p.rapidApiKey === 'string') o.rapidApiKey = p.rapidApiKey.substring(0, 200);
    if (typeof p.timeoutMs === 'number' && isFinite(p.timeoutMs)) o.timeoutMs = num(p.timeoutMs, 15000, 1000, 60000);
    if (typeof p.rateLimitPerMin === 'number' && isFinite(p.rateLimitPerMin)) o.rateLimitPerMin = num(p.rateLimitPerMin, 50, 1, 1000);
    if (typeof p.enableRotatingProxies === 'boolean') o.enableRotatingProxies = p.enableRotatingProxies;
    if (Array.isArray(p.proxyPool)) o.proxyPool = strArr(p.proxyPool, 20, 300);
    if (Object.keys(o).length > 0) partial.api = o;
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

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const noStore = { 'Cache-Control': 'no-store' };
  // Crawlers get 5x quota on GET (public settings read) so aggressive indexing
  // never hits 429s; writes and all other callers keep the strict quota.
  const readBoost = request.method === 'GET' && isSearchCrawler(request);
  if (checkRateLimit(request, 'site-settings', readBoost ? 600 : 120, 60 * 1000)) {
    return json({ error: 'Too many requests. Please wait a minute.' }, 429, noStore);
  }

  const cfg = getSbConfig(env);
  if (!cfg) {
    return json({ error: 'Settings database not configured.', supabase: false }, 503, noStore);
  }
  const secret = getEnv(env, 'SESSION_SECRET');

  try {
    if (request.method === 'GET') {
      let data: any | null;
      try {
        data = await sbGetOne(cfg, 'site_settings', {
          select: 'branding,seo_tracking,ads,api,seo_overrides',
          eq: { id: 'global' },
        });
      } catch (e: any) {
        // Safe detail only (never keys): distinguishes wrong URL / bad key
        // (401) / missing table from a truly empty row.
        return json({ error: 'Failed to load site settings.', detail: String(e?.message || e).substring(0, 160) }, 500, noStore);
      }
      if (!data) {
        return json({ error: 'Failed to load site settings.', detail: 'empty row' }, 500, noStore);
      }
      return json(
        {
          settings: {
            branding: data.branding && typeof data.branding === 'object' ? data.branding : {},
            seoTracking: data.seo_tracking && typeof data.seo_tracking === 'object' ? data.seo_tracking : {},
            ads: data.ads && typeof data.ads === 'object' ? data.ads : {},
            api: data.api && typeof data.api === 'object' ? data.api : {},
            seoOverrides: data.seo_overrides && typeof data.seo_overrides === 'object' ? data.seo_overrides : {},
          },
        },
        200,
        { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
      );
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
      if (!auth.valid) return unauthorized();
      const partial = sanitizePartial((await request.json().catch(() => null)) || {});
      if (Object.keys(partial).length === 0) {
        return json({ error: 'No valid settings provided.' }, 400, noStore);
      }
      const current = (await sbGetOne(cfg, 'site_settings', {
        select: 'branding,seo_tracking,ads,api,seo_overrides',
        eq: { id: 'global' },
      }).catch(() => null)) as any;
      const row: Record<string, any> = { id: 'global' };
      if (partial.branding !== undefined) row.branding = { ...((current as any)?.branding || {}), ...partial.branding };
      if (partial.seoTracking !== undefined) row.seo_tracking = { ...((current as any)?.seo_tracking || {}), ...partial.seoTracking };
      if (partial.ads !== undefined) row.ads = { ...((current as any)?.ads || {}), ...partial.ads };
      if (partial.api !== undefined) row.api = { ...((current as any)?.api || {}), ...partial.api };
      if (partial.seoOverrides !== undefined) row.seo_overrides = { ...((current as any)?.seo_overrides || {}), ...partial.seoOverrides };
      try {
        await sbUpsert(cfg, 'site_settings', row, 'id');
      } catch (e: any) {
        return json({ error: 'Failed to save site settings.', detail: String(e?.message || e).substring(0, 160) }, 500, noStore);
      }
      return json({ success: true }, 200, noStore);
    }

    return json({ error: 'Method not allowed.' }, 405, noStore);
  } catch (e: any) {
    return json({ error: e?.message || 'Settings API error.' }, 500, noStore);
  }
}
