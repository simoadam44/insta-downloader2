// Minimal Supabase PostgREST client over plain fetch — ZERO dependencies.
// The official @supabase/supabase-js bundle crashes in the Workers runtime,
// so all Pages Functions talk to PostgREST directly. Same tables, same
// service_role auth, same results. Throws on HTTP errors (callers map to 500).

import { getEnv } from './cf';

export interface SbConfig {
  url: string;
  key: string;
}

export function getSbConfig(env: Record<string, string | undefined>): SbConfig | null {
  let url = getEnv(env, 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').trim();
  // Keys are single-line tokens: surrounding whitespace (a classic copy-paste
  // accident from dashboards) always breaks auth, so drop it.
  const key = getEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY').trim();
  if (!url || !key) return null;
  try {
    // Keep ONLY scheme + host: a frequent dashboard copy includes a trailing
    // path (e.g. "...supabase.co/rest/v1" or a /dashboard/... page URL), which
    // makes PostgREST reject every request with "PGRST125: Invalid path".
    url = new URL(url).origin;
  } catch {
    url = url.replace(/\/+$/, '');
  }
  return { url, key };
}

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(extra || {}),
  };
}

async function errText(res: Response): Promise<string> {
  try {
    const data: any = await res.json();
    const msg = typeof data?.message === 'string' ? data.message : '';
    const code = typeof data?.code === 'string' ? data.code : '';
    return `${res.status}${code ? ` ${code}` : ''}${msg ? `: ${msg}` : ''}`.substring(0, 200);
  } catch {
    return `HTTP ${res.status}`;
  }
}

function buildQuery(select: string, eq: Record<string, string | boolean>, order?: string): string {
  const p = new URLSearchParams();
  p.set('select', select);
  for (const [k, v] of Object.entries(eq)) {
    p.set(k, typeof v === 'boolean' ? `eq.${v ? 'true' : 'false'}` : `eq.${v}`);
  }
  if (order) p.set('order', order);
  return p.toString();
}

// SELECT list. Throws on error.
export async function sbList(
  cfg: SbConfig,
  table: string,
  opts: { select: string; eq?: Record<string, string | boolean>; order?: string }
): Promise<any[]> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?${buildQuery(opts.select, opts.eq || {}, opts.order)}`, {
    headers: headers(cfg.key),
  });
  if (!res.ok) throw new Error(await errText(res));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// SELECT single row or null. Throws on error.
export async function sbGetOne(
  cfg: SbConfig,
  table: string,
  opts: { select: string; eq?: Record<string, string | boolean> }
): Promise<any | null> {
  const rows = await sbList(cfg, table, { select: opts.select, eq: opts.eq });
  return rows.length > 0 ? rows[0] : null;
}

// UPSERT one row (merge on conflict). Throws on error.
export async function sbUpsert(cfg: SbConfig, table: string, row: Record<string, any>, onConflict: string): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: headers(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await errText(res));
}

// DELETE by equality filter. Throws on error.
export async function sbDelete(cfg: SbConfig, table: string, eq: Record<string, string>): Promise<void> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(eq)) p.set(k, `eq.${v}`);
  const res = await fetch(`${cfg.url}/rest/v1/${table}?${p.toString()}`, {
    method: 'DELETE',
    headers: headers(cfg.key),
  });
  if (!res.ok) throw new Error(await errText(res));
}

// Exact row count (HEAD + Prefer count). Throws on error.
export async function sbCount(cfg: SbConfig, table: string): Promise<number> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: headers(cfg.key, { Prefer: 'count=exact' }),
  });
  if (!res.ok) throw new Error(await errText(res));
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}
