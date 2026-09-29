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
// `cache: no-store` forces a fresh read in THIS browser; edge caching is kept
// short server-side (s-maxage=30) so other browsers see saves within seconds.
export async function fetchSharedSettings(): Promise<SharedSettingsPayload | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/site-settings`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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
// NOTE: success requires the server's explicit `{ success: true }` — a bare
// HTTP 200 (SPA fallback page, proxy, stale cache) must NEVER count as saved.
export interface PushOutcome {
  result: PushResult;
  // Safe server detail (Supabase code/message only, never keys) for `no-db`
  // and `error` cases — shown in the admin notice to pinpoint the layer.
  detail?: string;
}

export async function pushSharedSettingsDetailed(payload: SharedSettingsPayload): Promise<PushOutcome> {
  try {
    const token = getAdminToken();
    if (!token) return { result: 'unauthorized' };
    // Fallback/offline tokens never hold server privileges — fail fast with a
    // clear signal instead of letting the server 401 speak vaguely.
    if (token.startsWith('fallback_admin_token_')) return { result: 'unauthorized', detail: 'offline-mode token' };
    const res = await fetch(`${getApiBase()}/api/site-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.success === true) return { result: 'ok' };
    if (res.status === 401) return { result: 'unauthorized', detail: typeof data?.error === 'string' ? data.error.substring(0, 120) : undefined };
    if (res.status === 503 || data?.supabase === false) {
      return {
        result: 'no-db',
        detail: typeof data?.error === 'string' ? `${data.error.substring(0, 120)}${data?.detail ? ` (${String(data.detail).substring(0, 120)})` : ''}` : undefined,
      };
    }
    return {
      result: 'error',
      detail: typeof data?.error === 'string' ? `${data.error.substring(0, 120)}${data?.detail ? ` (${String(data.detail).substring(0, 120)})` : ''}` : `HTTP ${res.status}`,
    };
  } catch {
    return { result: 'error', detail: 'network unreachable' };
  }
}

export async function pushSharedSettings(payload: SharedSettingsPayload): Promise<PushResult> {
  return (await pushSharedSettingsDetailed(payload)).result;
}

// Connectivity probe for the admin status badge — public GET, no auth needed.
// Distinguishes "DB not configured" (env/table) from "unreachable" (network).
export type SharedDbStatus = 'checking' | 'connected' | 'no-db' | 'unreachable';

export async function getSharedDbStatus(): Promise<Exclude<SharedDbStatus, 'checking'>> {
  try {
    const res = await fetch(`${getApiBase()}/api/site-settings`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data.settings === 'object' && data.settings) return 'connected';
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}
