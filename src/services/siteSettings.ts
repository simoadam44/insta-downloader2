import type { AdSettings, ApiSettings, SeoTrackingSettings, SiteBrandingSettings, ToolSeoContent } from '../types';

// Shared dashboard settings — server-side singleton (Supabase `site_settings`
// row id='global') so GA4/branding/ads/api are identical in every browser,
// private window and device. localStorage remains only as offline cache.
//
// Mirrors the existing keywordPages.ts / guides.ts sync pattern:
//   GET /api/site-settings  (public)  -> same settings for ALL visitors
//   PUT /api/site-settings  (admin Bearer) -> partial merge supported

export interface SharedSettingsPayload {
  branding?: SiteBrandingSettings;
  seoTracking?: SeoTrackingSettings;
  ads?: AdSettings;
  api?: ApiSettings;
  seoOverrides?: Record<string, ToolSeoContent>;
}

export type PushResult = 'ok' | 'no-db' | 'unauthorized' | 'error';

function getApiBase(): string {
  try {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  } catch {}
  return '';
}

function getAdminToken(): string {
  try {
    return localStorage.getItem('sss_admin_token') || '';
  } catch {
    return '';
  }
}

// Public read — used on app mount (visitors + admin). Returns null when the
// DB is not configured or the fetch fails (caller falls back to local cache).
export async function fetchSharedSettings(): Promise<SharedSettingsPayload | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/site-settings`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.settings !== 'object' || !data.settings) return null;
    const s = data.settings;
    const out: SharedSettingsPayload = {};
    if (s.branding && typeof s.branding === 'object') out.branding = s.branding;
    if (s.seoTracking && typeof s.seoTracking === 'object') out.seoTracking = s.seoTracking;
    if (s.ads && typeof s.ads === 'object') out.ads = s.ads;
    if (s.api && typeof s.api === 'object') out.api = s.api;
    if (s.seoOverrides && typeof s.seoOverrides === 'object') out.seoOverrides = s.seoOverrides;
    if (Object.keys(out).length === 0) return null;
    return out;
  } catch {
    return null;
  }
}

// Admin write — partial merge supported, e.g. { seoTracking } only.
// Never throws; callers switch on the result to show accurate save notices.
export async function pushSharedSettings(payload: SharedSettingsPayload): Promise<PushResult> {
  try {
    const token = getAdminToken();
    if (!token) return 'unauthorized';
    const res = await fetch(`${getApiBase()}/api/site-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'unauthorized';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}
