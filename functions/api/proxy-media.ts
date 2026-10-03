import { CfContext, checkRateLimit } from '../_lib/cf';

// Media Stream Proxy: bypasses CORS/referrer locks, forces download-friendly
// headers, enforces attachment-style delivery. Streams the upstream body
// straight through (no buffering) with per-hop SSRF re-validation.
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

const text = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  if (request.method !== 'GET') return text('Method not allowed.', 405);
  if (checkRateLimit(request, 'proxy', 120, 60 * 1000)) {
    return text('Rate limit exceeded. Please wait a minute.', 429);
  }
  const q = new URL(request.url).searchParams;
  const mediaUrl = q.get('url') || '';
  const rawFilename = q.get('filename') || 'instagram_media.mp4';
  if (!mediaUrl || mediaUrl.length > 2048 || !isAllowed(mediaUrl)) {
    return text('Access denied: host not allowed.', 403);
  }
  const safeFilename = rawFilename.replace(/[\r\n\0\t"\\]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: 'https://www.instagram.com/',
    Accept: '*/*',
  };
  const range = request.headers.get('range');
  if (range && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) {
    headers['Range'] = range;
  }

  // Manual redirects: every hop re-checked against the allowlist (SSRF-safe).
  let upstream: Response | null = null;
  let current = mediaUrl;
  for (let hop = 0; hop <= 3; hop++) {
    if (!isAllowed(current)) return text('Access denied: redirect target not allowed.', 403);
    let hopRes: Response;
    try {
      hopRes = await fetch(current, { headers, redirect: 'manual' });
    } catch {
      return text('Bad gateway: upstream unreachable.', 502);
    }
    if ([301, 302, 303, 307, 308].includes(hopRes.status)) {
      const loc = hopRes.headers.get('location');
      if (!loc) return text('Bad gateway: empty redirect.', 502);
      try {
        current = new URL(loc, current).toString();
      } catch {
        return text('Bad gateway: bad redirect target.', 502);
      }
      continue;
    }
    upstream = hopRes;
    break;
  }
  if (!upstream) return text('Bad gateway: too many redirects.', 502);
  if (!upstream.ok && upstream.status !== 206) {
    return text(`CDN fetch failed: HTTP ${upstream.status}.`, upstream.status);
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
    return text('Upstream CDN did not return media (link may have expired). Please refresh.', 502);
  }
  const outHeaders = new Headers();
  outHeaders.set('Content-Type', ct);
  outHeaders.set('Content-Disposition', `inline; filename="${safeFilename}"`);
  outHeaders.set('Accept-Ranges', 'bytes');
  outHeaders.set('Cache-Control', 'public, max-age=86400');
  outHeaders.set('X-Content-Type-Options', 'nosniff');
  const len = upstream.headers.get('content-length');
  if (len) outHeaders.set('Content-Length', len);
  // CRITICAL for <video>: a 206 WITHOUT Content-Range is rejected by Chrome
  // (MEDIA_ERR_SRC_NOT_SUPPORTED -> black player). Always forward it.
  const upstreamRange = upstream.headers.get('content-range');
  if (upstreamRange) outHeaders.set('Content-Range', upstreamRange);
  if (!upstream.body) {
    return new Response(null, { status: upstream.status, headers: outHeaders });
  }
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}
