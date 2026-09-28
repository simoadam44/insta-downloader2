import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GuideArticle, KeywordToolPage } from '../src/types';

let adminClient: SupabaseClient | null | undefined;
let lastError: string | null = null;

// Last Supabase error message (safe to expose: codes/messages only, never keys).
export function getSupabaseLastError(): string | null {
  return lastError;
}

export function getSupabaseUrl(): string {
  // Manual setup uses SUPABASE_URL; the native Supabase↔Vercel integration
  // syncs it as NEXT_PUBLIC_SUPABASE_URL. Accept both.
  return (
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  );
}

export function getSupabaseServiceKey(): string {
  // Manual setup uses SUPABASE_SERVICE_ROLE_KEY; the native Supabase↔Vercel
  // integration syncs the new-format key as SUPABASE_SECRET_KEY. Accept both.
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
}

export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseServiceKey());
}

export function getSupabaseAdmin(): SupabaseClient | null {
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
    if (error || !data) {
      lastError = error ? `${error.code || 'ERR'}: ${error.message}`.substring(0, 200) : 'empty';
      return null;
    }
    lastError = null;
    return data.map(rowToPage);
  } catch (e: any) {
    lastError = String(e?.message || e).substring(0, 200);
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
    sections: Array.isArray(r.sections) ? r.sections : [],
    faqs: Array.isArray(r.faqs) ? r.faqs : [],
    relatedSlugs: Array.isArray(r.related_slugs) ? r.related_slugs : [],
    enabled: r.enabled !== false,
    updatedAt: r.updated_at || undefined,
  };
}

function guideToRow(g: GuideArticle): Record<string, any> {
  return {
    id: g.id,
    slug: g.slug,
    lang: g.lang || 'en',
    keyword: g.keyword || '',
    tool: g.tool || 'video',
    title: g.title || '',
    meta_description: g.metaDescription || '',
    h1: g.h1 || '',
    excerpt: g.excerpt || '',
    sections: g.sections || [],
    faqs: g.faqs || [],
    related_slugs: g.relatedSlugs || [],
    enabled: g.enabled !== false,
  };
}

export async function listGuides(enabledOnly: boolean): Promise<GuideArticle[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    let q = sb.from('guide_articles').select('*').order('created_at', { ascending: true });
    if (enabledOnly) q = q.eq('enabled', true);
    const { data, error } = await q;
    if (error || !data) {
      lastError = error ? `${error.code || 'ERR'}: ${error.message}`.substring(0, 200) : 'empty';
      return null;
    }
    lastError = null;
    return data.map(rowToGuide);
  } catch (e: any) {
    lastError = String(e?.message || e).substring(0, 200);
    return null;
  }
}

export async function upsertGuide(guide: GuideArticle): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb.from('guide_articles').upsert(guideToRow(guide), { onConflict: 'id' });
    if (error) {
      lastError = `${error.code || 'ERR'}: ${error.message}`.substring(0, 200);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteGuide(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { error } = await sb.from('guide_articles').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
