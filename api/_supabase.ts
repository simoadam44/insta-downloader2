import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { KeywordToolPage } from '../src/types';

let adminClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  if (!isSupabaseConfigured()) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
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

export async function listKeywordPages(enabledOnly: boolean): Promise<KeywordToolPage[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    let q = sb.from('keyword_pages').select('*').order('created_at', { ascending: true });
    if (enabledOnly) q = q.eq('enabled', true);
    const { data, error } = await q;
    if (error || !data) return null;
    return data.map(rowToPage);
  } catch {
    return null;
  }
}

export async function upsertKeywordPage(page: KeywordToolPage): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb.from('keyword_pages').upsert(pageToRow(page), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteKeywordPage(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb.from('keyword_pages').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
