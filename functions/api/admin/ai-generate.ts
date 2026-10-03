import { CfContext, checkRateLimit, getEnv, json, unauthorized, verifyAdminToken } from '../../_lib/cf';

// AI content generator (Google Gemini via AI Studio key — admin Bearer required).
// The API key NEVER leaves the server: the dashboard calls this endpoint,
// which proxies to the Gemini API (text output only, light free model) and
// returns sanitized fields only.
// POST /api/admin/ai-generate { kind: 'guide'|'keyword', keyword, lang, tool }
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getModelChain(env: Record<string, string | undefined>): string[] {
  const fromEnv = getEnv(env, 'GEMINI_MODEL')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv.slice(0, 5);
  return ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'];
}

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

async function callGemini(apiKey: string, model: string, system: string, user: string, useJsonMode: boolean): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  try {
    // Text output only — no images, no tools — keeps token usage minimal.
    // Shorter edge timeout than the container backend (Workers bill wall-time).
    const body: Record<string, any> = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    };
    if (useJsonMode) body.generationConfig.responseMimeType = 'application/json';
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = typeof data?.error?.message === 'string' ? data.error.message : `Gemini HTTP ${res.status}`;
      return { ok: false, error: msg.substring(0, 200), status: res.status };
    }
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.filter((p: any) => typeof p?.text === 'string').map((p: any) => p.text).join('')
      : '';
    if (!text.trim()) {
      const blocked = data?.promptFeedback?.blockReason;
      return { ok: false, error: blocked ? `AI refused the request (${blocked}).` : 'Empty AI response.' };
    }
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

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const noStore = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noStore);
  }
  const secret = getEnv(env, 'SESSION_SECRET');
  const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
  if (!auth.valid) return unauthorized();
  if (checkRateLimit(request, 'ai-generate', 10, 60 * 1000)) {
    return json({ error: 'Too many AI requests. Please wait a minute and retry.' }, 429, noStore);
  }
  const apiKey = getEnv(env, 'GEMINI_API_KEY');
  if (!apiKey) {
    return json({ error: 'AI generator not configured. Set GEMINI_API_KEY on the host (get one free at aistudio.google.com).', ai: false }, 503, noStore);
  }
  const body = (await request.json().catch(() => null)) as any;
  const kind = body?.kind === 'keyword' ? 'keyword' : 'guide';
  const keyword = typeof body?.keyword === 'string' ? body.keyword.trim().substring(0, 120) : '';
  const lang = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'].includes(body?.lang) ? body.lang : 'en';
  const tool = ['video', 'photo', 'reels', 'story', 'highlights'].includes(body?.tool) ? body.tool : 'video';
  if (keyword.length < 3) {
    return json({ error: 'Enter a Target Keyword (min 3 characters) before generating.' }, 400, noStore);
  }
  try {
    const { system, user } = buildAiPrompts(kind, keyword, lang, tool);
    const models = getModelChain(env);
    let text: string | null = null;
    const failures: string[] = [];
    let sawRateLimit = false;
    for (const model of models) {
      let attempt = await callGemini(apiKey, model, system, user, true);
      if (!attempt.ok && attempt.status === 400 && /responseMimeType|response_mime|json/i.test(attempt.error || '')) {
        attempt = await callGemini(apiKey, model, system, user, false);
      }
      if (attempt.ok && attempt.text) {
        text = attempt.text;
        break;
      }
      if (attempt.status === 400 && /API_KEY_INVALID|API key not valid/i.test(attempt.error || '')) {
        return json({ error: 'AI key rejected by Google. Check GEMINI_API_KEY.' }, 502, noStore);
      }
      if (attempt.status === 403) {
        return json({ error: 'AI key lacks permission (check API restrictions in Google AI Studio).' }, 502, noStore);
      }
      if (attempt.status === 429) {
        sawRateLimit = true;
        failures.push(`${model}: quota exceeded`);
        continue;
      }
      failures.push(`${model}: ${attempt.error || `HTTP ${attempt.status || '?'}`}`);
    }
    if (!text) {
      const tried = failures.join(' | ').substring(0, 300);
      if (sawRateLimit && failures.every((f) => /quota exceeded/i.test(f))) {
        return json({ error: 'Free AI quota exceeded right now. Wait a minute and retry.', hint: 'Tried: ' + models.join(', ') + '.' }, 502, noStore);
      }
      return json({ error: tried || 'AI generation failed.', hint: 'Set GEMINI_MODEL to a current free Gemini model id.' }, 502, noStore);
    }
    const fields = sanitizeAiFields(kind, extractJsonObject(text));
    if (!fields) return json({ error: 'AI returned unusable content. Please retry.' }, 502, noStore);
    return json({ fields }, 200, noStore);
  } catch (e: any) {
    return json({ error: e?.message || 'AI generator error.' }, 500, noStore);
  }
}
