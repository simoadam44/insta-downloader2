import type { LanguageCode, MediaType } from '../types';

// AI autofill client — calls OUR backend proxy (POST /api/admin/ai-generate),
// which holds the Gemini key server-side. The key never reaches the browser.
// Returns generated fields (partial — only keys the AI produced) or an error.
// Never throws.

export type AiKind = 'guide' | 'keyword';

export interface AiGenerateInput {
  keyword: string;
  lang: LanguageCode;
  tool: MediaType;
}

export interface AiGenerateResult {
  ok: boolean;
  fields?: Record<string, any>;
  error?: string;
}

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

export async function requestAiFill(kind: AiKind, input: AiGenerateInput): Promise<AiGenerateResult> {
  const keyword = (input.keyword || '').trim();
  if (keyword.length < 3) {
    return { ok: false, error: 'Enter a Target Keyword (min 3 characters) before generating.' };
  }
  const token = getAdminToken();
  if (!token || token.startsWith('fallback_admin_token_')) {
    return { ok: false, error: 'Admin session is offline. Log in with the server password to use AI generation.' };
  }
  try {
    const res = await fetch(`${getApiBase()}/api/admin/ai-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, keyword: keyword.substring(0, 120), lang: input.lang, tool: input.tool }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data.fields === 'object' && data.fields) {
      return { ok: true, fields: data.fields as Record<string, any> };
    }
    if (res.status === 401) return { ok: false, error: 'Session expired. Log in again to use AI generation.' };
    if (res.status === 429) return { ok: false, error: 'Too many AI requests. Wait a minute and retry.' };
    const detail = typeof data?.error === 'string' ? data.error : '';
    const hint = typeof data?.hint === 'string' ? ` ${data.hint}` : '';
    return { ok: false, error: (detail || `AI generation failed (HTTP ${res.status}).`) + hint };
  } catch {
    return { ok: false, error: 'AI service unreachable. Check connection and retry.' };
  }
}

// Fill-empty-only merge: writes each AI field ONLY when the current form
// value is empty — anything the admin typed by hand is never overwritten.
export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
