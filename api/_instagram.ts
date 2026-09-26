// Shared Instagram extraction helpers — used by Vercel serverless functions.
// Keeping it dependency-free so it runs on both Vercel and Cloud Run.

export function extractShortcode(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const shareSub = trimmed.match(/\/share\/(?:p|r|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
  if (shareSub?.[1]) return shareSub[1];
  const shareGen = trimmed.match(/\/share\/([a-zA-Z0-9_-]{5,35})/i);
  if (shareGen?.[1] && !['p', 'r', 'reel', 'reels', 'tv'].includes(shareGen[1].toLowerCase())) return shareGen[1];
  const std = trimmed.match(/\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
  if (std?.[2]) return std[2];
  if (/^[a-zA-Z0-9_-]{6,35}$/.test(trimmed)) return trimmed;
  return null;
}

export function cleanUrl(s: string | null | undefined): string {
  if (!s) return '';
  let out = s.trim();
  try {
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  } catch {}
  out = out.replace(/\\u0026/gi, '&').replace(/\\u002F/gi, '/');
  out = out.replace(/\\+\//g, '/').replace(/\\"/g, '"').replace(/\\/g, '');
  return out;
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const BOT_UA = 'TelegramBot (like TwitterBot)';

/**
 * FREE provider — kkscript embed mirrors (https://github.com/kkscript/kk).
 * No API key, no login. GET /{reel|p}/{shortcode}/ with a chat-bot UA returns
 * `302 Location: <direct Instagram CDN mp4/jpg URL>`. Verified working 2026.
 */
const KK_HOSTS = ['kkinstagram.com', 'kkclip.com'];

export async function fetchViaKkMirror(
  shortcode: string
): Promise<{ url: string; isVideo: boolean } | null> {
  const paths = [`/reel/${shortcode}/`, `/p/${shortcode}/`];
  for (const host of KK_HOSTS) {
    for (const p of paths) {
      try {
        const r = await fetch(`https://${host}${p}`, {
          method: 'GET',
          headers: { 'User-Agent': BOT_UA, Accept: '*/*' },
          redirect: 'manual',
          signal: AbortSignal.timeout(12000),
        });
        if (r.status !== 301 && r.status !== 302) continue;
        const loc = r.headers.get('location') || '';
        if (!loc) continue;
        const low = loc.toLowerCase();
        const isCdn = low.includes('cdninstagram.com') || low.includes('fbcdn.net');
        if (!isCdn) continue;
        return { url: loc, isVideo: /\.mp4/i.test(loc.split('?')[0]) };
      } catch {}
    }
  }
  return null;
}

/** Step 0 — oEmbed: public, no login, validates that the post exists & is public. */
export async function fetchOEmbed(postUrl: string) {
  for (const base of ['https://www.instagram.com/api/v1/oembed/?url=', 'https://i.instagram.com/api/v1/oembed?url=']) {
    try {
      const r = await fetch(base + encodeURIComponent(postUrl), {
        headers: { 'User-Agent': DESKTOP_UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) return (await r.json()) as any;
    } catch {}
  }
  return null;
}

/** Step 1 — authenticated embed fetch (works only when IG_SESSIONID is set). */
export async function fetchEmbedHtml(shortcode: string): Promise<string | null> {
  const sessionId = process.env.IG_SESSIONID || '';
  const dsUser = process.env.IG_DS_USER_ID || '';
  const csrftoken = process.env.IG_CSRFTOKEN || '';
  const headers: Record<string, string> = {
    'User-Agent': DESKTOP_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.instagram.com/',
  };
  if (sessionId) {
    let cookie = `sessionid=${sessionId};`;
    if (dsUser) cookie += ` ds_user_id=${dsUser};`;
    if (csrftoken) cookie += ` csrftoken=${csrftoken};`;
    headers['Cookie'] = cookie;
    headers['X-CSRFToken'] = csrftoken || sessionId.slice(0, 32);
  }
  for (const u of [
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
  ]) {
    try {
      const r = await fetch(u, { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const html = await r.text();
      if (html.includes('video_url') || html.includes('display_url') || html.includes('og:video') || html.includes('og:image')) {
        return html;
      }
    } catch {}
  }
  return null;
}

export function parseEmbedHtml(html: string) {
  let video: string | null = null;
  let image: string | null = null;
  let username: string | null = null;
  const vPats = [
    /\\"video_url\\":\\"([^"]+)\\"/, /"video_url":"([^"]+)"/,
    /<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+)"/i,
    /(https?:\\?\/\\?\/[^\s"<>]+\.mp4[^\s"<>]*)/i, /(https:\/\/[^\s"<>]+\.mp4[^\s"<>]*)/i,
  ];
  for (const p of vPats) {
    const m = html.match(p);
    if (m?.[1]) { video = cleanUrl(m[1]); break; }
  }
  const iPats = [
    /\\"display_url\\":\\"([^"]+)\\"/, /"display_url":"([^"]+)"/,
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
  ];
  for (const p of iPats) {
    const m = html.match(p);
    if (m?.[1]) { image = cleanUrl(m[1]); break; }
  }
  const u = html.match(/\\"username\\":\\"([^"\\]+)\\"/) || html.match(/"username":"([^"\\]+)"/);
  if (u?.[1]) username = u[1].trim();
  return { video, image, username };
}

/** Step 2 — RapidAPI provider (most reliable on datacenter IPs). */
export async function fetchViaRapidApi(postUrl: string) {
  const key = process.env.RAPIDAPI_KEY || '';
  if (!key) return null;
  const host =
    process.env.RAPIDAPI_HOST || 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com';
  try {
    const r = await fetch(`https://${host}/api?url=${encodeURIComponent(postUrl)}`, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Step 3 — Cobalt-compatible instance (self-hostable, no login). */
export async function fetchViaCobalt(postUrl: string) {
  const base = (process.env.COBALT_API_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: postUrl, videoQuality: '1080', filenameStyle: 'basic' }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
