import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// SELF-CONTAINED Vercel function — zero local-file imports.
// AI content generator (OpenRouter proxy — the API key NEVER reaches the browser).
//   POST /api/admin/ai-generate { kind: 'guide'|'keyword', keyword, lang, tool }
//   -> { fields: {...} }  (admin Bearer required, strict rate limit)

function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
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

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getPrimaryModel(): string {
  return process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
}
const FALLBACK_MODEL = 'google/gemma-3-27b-it:free';

function buildAiPrompts(kind: 'guide' | 'keyword', keyword: string, lang: string, tool: string): { system: string; user: string } {
  const langNames: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', ar: 'Arabic',
    pt: 'Portuguese', de: 'German', id: 'Indonesian', tr: 'Turkish',
  };
  const language = langNames[lang] || 'English';
  const toolNames: Record<string, string> = {
    video: 'Instagram videos', photo: 'Instagram photos', reels: 'Instagram Reels',
    story: 'Instagram stories', highlights: 'Instagram highlights',
  };
  const toolLabel = toolNames[tool] || 'Instagram videos';
  const system =
    `You are an SEO copywriter for IGSaveGo, a free anonymous online tool that downloads ${toolLabel} in HD with no login and no watermark. ` +
    `Write ONLY valid JSON (no markdown fences, no commentary) matching the requested keys exactly. ` +
    `Write in ${language}. Never mention logging in, accounts, payments, or a mobile app. Keep texts factual and concise.`;
  if (kind === 'keyword') {
    return {
      system,
      user:
        `Target keyword: "${keyword}". Tool: ${toolLabel}. Language: ${language}. ` +
        `Return JSON with exactly these keys: ` +
        `{"slug": "url-slug-in-english-lowercase-with-dashes", "badge": "SHORT 2-3 WORD LABEL", ` +
        `"title": "SEO page title max 60 chars including the keyword", ` +
        `"metaDescription": "compelling meta description 140-160 chars including the keyword", ` +
        `"h1": "main heading including the keyword", ` +
        `"subtitle": "one helpful sentence expanding the h1"}. ` +
        (lang === 'ar'
          ? 'The slug stays in English; all other texts in Arabic.'
          : 'All texts in ' + language + '.'),
    };
  }
  return {
    system,
    user:
      `Target keyword (a how-to question topic): "${keyword}". Related tool: ${toolLabel}. Language: ${language}. ` +
      `Return JSON with exactly these keys: ` +
      `{"slug": "url-slug-in-english-lowercase-with-dashes", ` +
      `"title": "SEO article title max 60 chars including the keyword", ` +
      `"metaDescription": "compelling meta description 140-160 chars including the keyword", ` +
      `"h1": "article heading including the keyword", ` +
      `"excerpt": "two-sentence summary for the blog hub card", ` +
      `"sections": [{"heading": "...", "body": "2-4 helpful sentences with concrete steps"}, exactly 4 items], ` +
      `"faqs": [{"question": "...", "answer": "1-3 sentences"}, exactly 5 items]}. ` +
      (lang === 'ar'
        ? 'The slug stays in English; all other texts in Arabic.'
        : 'All texts in ' + language + '.'),
  };
}

function extractJsonObject(raw: string): any | null {
  try {
    let s = (raw || '').trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence) s = fence[1].trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(s.substring(start, end + 1));
  } catch {
    return null;
  }
}

async function callOpenRouter(apiKey: string, model: string, system: string, user: string): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://www.igsavego.com/admin',
        'X-Title': 'IGSaveGo Admin AI Generator',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(55000),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = typeof data?.error?.message === 'string' ? data.error.message : `OpenRouter HTTP ${res.status}`;
      return { ok: false, error: msg.substring(0, 200), status: res.status };
    }
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Empty AI response.' };
    return { ok: true, text };
  } catch (e: any) {
    const timedOut = e?.name === 'TimeoutError' || /timeout|aborted/i.test(String(e?.message || ''));
    return { ok: false, error: timedOut ? 'AI request timed out, please retry.' : 'AI provider unreachable.' };
  }
}

function sanitizeAiFields(kind: 'guide' | 'keyword', raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v: any, max: number): string => (typeof v === 'string' ? v.trim().substring(0, max) : '');
  const out: Record<string, any> = {};
  const slug = str(raw.slug, 160);
  if (slug) out.slug = slug;
  const title = str(raw.title, 200);
  if (title) out.title = title;
  const metaDescription = str(raw.metaDescription, 400);
  if (metaDescription) out.metaDescription = metaDescription;
  const h1 = str(raw.h1, 200);
  if (h1) out.h1 = h1;
  if (kind === 'keyword') {
    const badge = str(raw.badge, 60);
    if (badge) out.badge = badge;
    const subtitle = str(raw.subtitle, 300);
    if (subtitle) out.subtitle = subtitle;
    if (!out.title || !out.h1) return null;
    return out;
  }
  const excerpt = str(raw.excerpt, 400);
  if (excerpt) out.excerpt = excerpt;
  if (Array.isArray(raw.sections)) {
    const sections = raw.sections
      .slice(0, 5)
      .filter((s: any) => s && typeof s === 'object')
      .map((s: any) => ({ heading: str(s.heading, 200), body: str(s.body, 2000) }))
      .filter((s: any) => s.heading && s.body);
    if (sections.length > 0) out.sections = sections;
  }
  if (Array.isArray(raw.faqs)) {
    const faqs = raw.faqs
      .slice(0, 6)
      .filter((f: any) => f && typeof f === 'object')
      .map((f: any) => ({ question: str(f.question, 300), answer: str(f.answer, 2000) }))
      .filter((f: any) => f.question && f.answer);
    if (faqs.length > 0) out.faqs = faqs;
  }
  if (!out.title || !out.h1) return null;
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const auth = verifyAdminToken(req.headers.authorization);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });
  if (checkRateLimit(req, 'ai-generate', 10, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait a minute and retry.' });
  }
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({ error: 'AI generator not configured. Set OPENROUTER_API_KEY on the host.', ai: false });
  }
  const body = (req.body || {}) as any;
  const kind = body.kind === 'keyword' ? 'keyword' : 'guide';
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim().substring(0, 120) : '';
  const lang = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body.lang) ? body.lang : 'en';
  const tool = ['video', 'photo', 'reels', 'story', 'highlights'].includes(body.tool) ? body.tool : 'video';
  if (keyword.length < 3) {
    return res.status(400).json({ error: 'Enter a Target Keyword (min 3 characters) before generating.' });
  }
  try {
    const { system, user } = buildAiPrompts(kind, keyword, lang, tool);
    let attempt = await callOpenRouter(apiKey, getPrimaryModel(), system, user);
    if (!attempt.ok && attempt.status !== 401 && attempt.status !== 402 && attempt.status !== 429) {
      attempt = await callOpenRouter(apiKey, FALLBACK_MODEL, system, user);
    }
    if (!attempt.ok) {
      if (attempt.status === 401) return res.status(502).json({ error: 'AI key rejected by OpenRouter. Check OPENROUTER_API_KEY.' });
      if (attempt.status === 402) return res.status(502).json({ error: 'OpenRouter credits exhausted for this key.' });
      if (attempt.status === 429) return res.status(502).json({ error: 'AI provider rate-limited. Wait a minute and retry.' });
      return res.status(502).json({ error: attempt.error || 'AI generation failed.', hint: 'If models changed, set OPENROUTER_MODEL to a current :free model id.' });
    }
    const fields = sanitizeAiFields(kind, extractJsonObject(attempt.text || ''));
    if (!fields) return res.status(502).json({ error: 'AI returned unusable content. Please retry.' });
    return res.status(200).json({ fields });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI generator error.' });
  }
}
