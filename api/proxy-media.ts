import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project.)

function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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

function isAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (
      h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') ||
      /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(h)
    ) return false;
    const roots = ['cdninstagram.com', 'fbcdn.net', 'instagram.com', 'threads.net', 'unsplash.com', 'pixabay.com', 'googleapis.com'];
    return roots.some((r) => h === r || h.endsWith('.' + r));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (checkRateLimit(req, 'proxy', 120, 60 * 1000)) {
    return res.status(429).send('Rate limit exceeded. Please wait a minute.');
  }
  const mediaUrl = req.query.url as string;
  const rawFilename = (req.query.filename as string) || 'instagram_media.mp4';
  if (!mediaUrl || typeof mediaUrl !== 'string' || mediaUrl.length > 2048 || !isAllowed(mediaUrl)) {
    return res.status(403).send('Access denied: host not allowed.');
  }
  const safeFilename = rawFilename.replace(/[\r\n\0\t"\\]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: 'https://www.instagram.com/',
    Accept: '*/*',
  };
  if (req.headers.range && typeof req.headers.range === 'string' && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(req.headers.range)) {
    headers['Range'] = req.headers.range;
  }

  // Manual redirects: every hop re-checked against the allowlist (SSRF-safe).
  let upstream: Response | null = null;
  let current = mediaUrl;
  for (let hop = 0; hop <= 3; hop++) {
    if (!isAllowed(current)) return res.status(403).send('Access denied: redirect target not allowed.');
    const hopRes = await fetch(current, { headers, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(hopRes.status)) {
      const loc = hopRes.headers.get('location');
      if (!loc) return res.status(502).send('Bad gateway: empty redirect.');
      current = new URL(loc, current).toString();
      continue;
    }
    upstream = hopRes;
    break;
  }
  if (!upstream) return res.status(502).send('Bad gateway: too many redirects.');
  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status).send(`CDN fetch failed: HTTP ${upstream.status}`);
  }
  const ct = upstream.headers.get('content-type') || (safeFilename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
  // Guard: never serve an upstream error page (e.g. expired CDN signature
  // returning HTML) as if it were media — that causes black players and
  // confused downloads. Fail loudly so the UI can mint a fresh link.
  if (
    !ct.startsWith('video/') &&
    !ct.startsWith('image/') &&
    !ct.startsWith('audio/') &&
    ct !== 'application/octet-stream'
  ) {
    return res.status(502).send('Upstream CDN did not return media (link may have expired). Please refresh.');
  }
  res.setHeader('Content-Type', ct);
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const len = upstream.headers.get('content-length');
  if (len) res.setHeader('Content-Length', len);
  res.status(upstream.status);
  if (!upstream.body) return res.end();
  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}
