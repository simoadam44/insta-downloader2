import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the
// Pinterest logic is inlined here. Keep it in sync with lib/pinterestExtract.ts,
// which is the source used by Cloudflare Pages Functions and server.ts.)

const PINTEREST_ORIGIN = 'https://www.pinterest.com';
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const PROBE_TIMEOUT_MS = 6000;
const PAGE_ATTEMPTS = 2;
const MAX_TEXT = 600;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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

// ---------- formatting ----------
function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function durationLabel(ms: number | null): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------- URL parsing ----------
const PIN_PATH = /\/pin\/(?:[\w-]{1,120}--)?(\d{6,25})(?:[/?#]|$)/i;
const SHORT_PATH = /^\/([A-Za-z0-9]{3,40})\/?$/;

function parsePinUrl(rawInput: string): { id: string; shortCode?: string } | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > 2048) return null;
  if (/^\d{6,25}$/.test(input)) return { id: input };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  const isShort = host === 'pin.it' || host.endsWith('.pin.it');
  if (isShort) {
    const match = parsed.pathname.match(SHORT_PATH);
    return match ? { id: '', shortCode: match[1] } : null;
  }
  if (host !== 'pinterest.com' && !host.endsWith('.pinterest.com')) {
    // Country domains (de.pinterest.com, pinterest.co.uk, pinterest.fr, ...)
    // carry the same pin ids; only the id is kept, because the fetch target is
    // rebuilt as www.pinterest.com/pin/<id>/.
    if (!/^(?:[a-z]{2,3}\.)?pinterest\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(host)) {
      return null;
    }
  }
  const match = parsed.pathname.match(PIN_PATH);
  return match ? { id: match[1] } : null;
}

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function errorForStatus(status: number): HttpError {
  if (status === 404 || status === 410) {
    return new HttpError(
      'Pinterest did not return this pin. It may be deleted, secret, or limited to signed-in members.',
      404
    );
  }
  if (status === 403 || status === 429) {
    return new HttpError(
      'Pinterest refused the request from this server (HTTP ' +
        status +
        '). That is Pinterest rate-limiting automated access — please try again in a few minutes.',
      503
    );
  }
  return new HttpError(`Pinterest returned HTTP ${status} for this pin. Please try again.`, 502);
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw errorForStatus(response.status);
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      throw new HttpError('Pinterest returned a page larger than expected. Please try again.', 502);
    }
    return html;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Pinterest did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveShortLink(code: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://pin.it/${encodeURIComponent(code)}`, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
    });
    const match = new URL(response.url).pathname.match(PIN_PATH);
    if (!match) throw new HttpError('That pin.it link did not lead to a Pinterest pin.', 404);
    return match[1];
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Could not follow that pin.it link. Please paste the full pin URL instead.', 400);
  } finally {
    clearTimeout(timer);
  }
}

async function probeMedia(url: string): Promise<{ bytes: number | null; mime: string; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      signal: controller.signal,
    });
    const length = Number(response.headers.get('content-length'));
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    return { bytes: Number.isFinite(length) && length > 0 ? length : null, mime, ok: response.ok };
  } catch {
    return { bytes: null, mime: '', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- HTML parsing ----------
const STOP_CHARS = new Set(['"', "'", '\\', ' ', '<', '>', ')', ',', ']', '}']);

function urlsWith(html: string, prefix: string): string[] {
  const out = new Set<string>();
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf(prefix, from);
    if (at < 0) break;
    let end = at + prefix.length;
    while (end < html.length && !STOP_CHARS.has(html[end])) end++;
    if (end > at + prefix.length) out.add(html.slice(at, end));
    from = end > at ? end : at + 1;
  }
  return [...out];
}

function allJsonStrings(html: string, key: string): string[] {
  const marker = `"${key}":"`;
  const out: string[] = [];
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf(marker, from);
    if (at < 0) break;
    let i = at + marker.length;
    let value = '';
    while (i < html.length) {
      const ch = html[i];
      if (ch === '\\') {
        const next = html[i + 1];
        value += next === 'n' ? ' ' : (next ?? '');
        i += 2;
        continue;
      }
      if (ch === '"') break;
      value += ch;
      i++;
    }
    out.push(value);
    from = i + 1;
  }
  return out;
}

function jsonString(html: string, key: string): string {
  return allJsonStrings(html, key)[0] || '';
}

const UI_WORDS = new Set(['saves', 'save', 'comments', 'comment', 'follow', 'share', 'like', 'likes', 'pins', 'more']);

function pickCaption(html: string, id: string): string {
  const grid = jsonString(html, 'gridTitle').trim();
  if (grid) return grid.substring(0, MAX_TEXT);
  const descriptions = allJsonStrings(html, 'description')
    .map((value) => value.trim())
    .filter((value) => value.length > 2 && !UI_WORDS.has(value.toLowerCase()))
    .filter((value) => !/deine eigenen Pins|your own Pins|Pins bei Pinterest/i.test(value))
    .sort((a, b) => b.length - a.length);
  return (descriptions[0] || `Pinterest pin ${id}`).substring(0, MAX_TEXT);
}

function videoRank(url: string): number {
  if (url.includes('/1080p/')) return 1080;
  if (url.includes('/720p/')) return 720;
  if (url.includes('/480p/')) return 480;
  if (url.includes('/360p/')) return 360;
  // /videos/iht/ renditions name their width instead: _720w.mp4, _540w.mp4.
  const width = url.match(/_(\d{3,4})w\.mp4$/i);
  if (width) return Number(width[1]);
  return 100;
}

function imageRank(url: string): number {
  if (url.includes('/originals/')) return 10000;
  if (url.includes('/736x/')) return 736;
  if (url.includes('/564x/')) return 564;
  if (url.includes('/474x/')) return 474;
  if (url.includes('/236x/')) return 236;
  return 0;
}

function toOriginalImage(url: string): string {
  return url.replace(/\/(?:\d+x|originals)\//, '/originals/');
}

interface ParsedPin {
  title: string;
  pinner: string;
  /** Rendition hash, e.g. 420de0dc1d7ce9ddcc883684ba3948a4, when present. */
  videoHash: string;
  mp4s: string[];
  hls: string[];
  images: string[];
  metaFor: (url: string) => { width: number | null; height: number | null; durationMs: number | null };
}

function parseHtml(html: string, id: string): ParsedPin {
  const signature = jsonString(html, 'imageSignature');
  const pinnerMatch = html.match(/"pinner":\{[^}]*"username":"([^"]{1,120})"/);
  // Video pins link their renditions under /videos/mc/ (progressive MP4) or
  // /videos/iht/ (AV1/HEVC MP4, HLS, DASH). Collect both; the rendition hash is
  // kept so the plain H.264 file can be addressed directly below.
  const videoUrls = urlsWith(html, 'https://v1.pinimg.com/videos/');
  const hashMatch = videoUrls
    .map((url) => url.match(/\/([0-9a-f]{32})\.(?:mp4|m3u8|mpd)/i))
    .find((match): match is RegExpMatchArray => Boolean(match));

  return {
    title: pickCaption(html, id),
    pinner: pinnerMatch ? pinnerMatch[1] : '',
    videoHash: hashMatch ? hashMatch[1].toLowerCase() : '',
    mp4s: videoUrls.filter((url) => /\.mp4$/i.test(url)),
    hls: videoUrls.filter((url) => /\.(?:m3u8|mpd)$/i.test(url)),
    images: signature
      ? urlsWith(html, 'https://i.pinimg.com/').filter((url) => url.includes(signature))
      : [],
    metaFor: (url: string) => {
      const at = html.indexOf(url);
      const window = at > 500 ? html.slice(at - 500, at) : at > 0 ? html.slice(0, at) : '';
      const width = window.match(/"width":(\d{2,5})/g);
      const height = window.match(/"height":(\d{2,5})/g);
      const duration = window.match(/"duration":(\d{3,8})/g);
      const lastNumber = (list: RegExpMatchArray | null) =>
        list && list.length > 0 ? Number(list[list.length - 1].split(':')[1]) : null;
      return {
        width: lastNumber(width),
        height: lastNumber(height),
        durationMs: lastNumber(duration),
      };
    },
  };
}

function isProxyableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'pinimg.com' || host.endsWith('.pinimg.com');
}

// ---------- handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (checkRateLimit(req, 'pinterest', 30, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const rawUrl = String((req.query.url as string) || req.body?.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error: 'Paste a public Pinterest pin link, for example https://www.pinterest.com/pin/664281013778109217/',
    });
  }
  if (rawUrl.length > 2048) return res.status(414).json({ error: 'URL is too long.' });

  const ref = parsePinUrl(rawUrl);
  if (!ref) {
    return res.status(400).json({
      error: 'Paste a public Pinterest pin link, for example https://www.pinterest.com/pin/664281013778109217/',
    });
  }

  try {
    const id = ref.id || (await resolveShortLink(ref.shortCode || ''));
    const canonicalUrl = `${PINTEREST_ORIGIN}/pin/${id}/`;

    let html = '';
    let lastError: HttpError | null = null;
    for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      try {
        html = await fetchHtml(canonicalUrl);
        break;
      } catch (error) {
        lastError = error instanceof HttpError ? error : new HttpError('Could not read that pin.', 502);
        if (lastError.status !== 502) break;
      }
    }
    if (!html) throw lastError ?? new HttpError('Could not read that Pinterest pin. Please try again.', 502);

    const parsed = parseHtml(html, id);
    const imageUrl = [...parsed.images].sort((a, b) => imageRank(b) - imageRank(a))[0] || '';
    const originalImage = imageUrl ? toOriginalImage(imageUrl) : '';

    // Renditions in the order they are tried: the plain H.264 720p file first
    // (plays everywhere), then whatever MP4s the pin listed, widest first. Each
    // candidate is confirmed with a HEAD request, so a 404 falls through instead
    // of being offered to the user.
    const hash = parsed.videoHash;
    const hashPath = hash ? `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4, 6)}/${hash}` : '';
    const videoCandidates = [
      ...(hashPath ? [`https://v1.pinimg.com/videos/iht/720p/${hashPath}.mp4`] : []),
      ...[...parsed.mp4s].sort((a, b) => videoRank(b) - videoRank(a)),
    ].slice(0, 5);

    let videoUrl = '';
    let videoProbe: { bytes: number | null; mime: string; ok: boolean } = { bytes: null, mime: '', ok: false };
    for (const candidate of videoCandidates) {
      const probe = await probeMedia(candidate);
      if (probe.ok && probe.mime.startsWith('video/')) {
        videoUrl = candidate;
        videoProbe = probe;
        break;
      }
    }

    if (!videoUrl && !imageUrl) {
      return res.status(404).json({
        error:
          'This Pinterest pin has no public video or image to download. Hidden or secret pins, and pins that only link to another website, cannot be extracted — open a pin that contains the media itself and paste its link.',
      });
    }

    const imageProbe = originalImage
      ? await probeMedia(originalImage)
      : imageUrl
        ? await probeMedia(imageUrl)
        : { bytes: null, mime: '', ok: false };

    const imageResolved = originalImage && imageProbe.ok ? originalImage : imageUrl || originalImage;
    const handle = parsed.pinner || 'pinterest';
    const fileBase = `igsavego_pinterest_${id}_${handle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}`;

    let usedDirectLink = false;
    const proxied = (source: string, filename: string): string => {
      let host = '';
      try {
        host = new URL(source).hostname;
      } catch {
        host = '';
      }
      if (!isProxyableHost(host)) {
        usedDirectLink = true;
        return source;
      }
      return `/api/proxy-media?url=${encodeURIComponent(source)}&filename=${encodeURIComponent(filename)}`;
    };

    const items: any[] = [];
    const notes: string[] = [];

    if (videoUrl) {
      const meta = parsed.metaFor(videoUrl);
      const dimensions = meta.width && meta.height ? `${meta.width}:${meta.height}` : '';
      const sizeLabel = formatBytes(videoProbe.bytes);
      const downloadUrl = proxied(videoUrl, `${fileBase}.mp4`);
      items.push({
        id: `item_${id}_video`,
        type: 'video',
        url: downloadUrl,
        downloadUrl,
        thumbnail: imageResolved || videoUrl,
        quality: 'Pin video',
        dimensions,
        fileSize: sizeLabel,
        format: 'mp4',
        availableQualities: [
          {
            id: 'original',
            label: 'Pin video (MP4)',
            quality: 'original',
            resolution: dimensions ? `Aspect ratio ${dimensions}` : '',
            fileSize: sizeLabel,
            downloadUrl,
            format: 'mp4',
            bitrate: 'File as published by Pinterest',
          },
        ],
      });
    }

    if (imageResolved) {
      const mime = imageProbe.mime;
      const format: 'jpg' | 'png' | 'webp' = mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : 'jpg';
      const label = videoUrl
        ? 'Video cover image'
        : mime
          ? `Original image (${format.toUpperCase()})`
          : 'Image as published by Pinterest';
      const downloadUrl = proxied(imageResolved, `${fileBase}${videoUrl ? '_cover' : ''}.${format}`);
      const sizeLabel = formatBytes(imageProbe.bytes);
      items.push({
        id: `item_${id}_${videoUrl ? 'cover' : 'image'}`,
        type: 'photo',
        url: imageResolved,
        downloadUrl,
        thumbnail: imageResolved,
        quality: videoUrl ? 'Cover image' : `${format.toUpperCase()} image`,
        dimensions: '',
        fileSize: sizeLabel,
        format,
        availableQualities: [
          {
            id: 'original',
            label,
            quality: 'original',
            resolution: '',
            fileSize: sizeLabel,
            downloadUrl,
            format,
          },
        ],
      });
    }

    const videoMeta = videoUrl ? parsed.metaFor(videoUrl) : { durationMs: null };
    const duration = durationLabel(videoMeta.durationMs);

    if (!videoUrl && parsed.hls.length > 0) {
      notes.push(
        'Pinterest exposed only a streaming playlist (HLS) for this pin, which is not a single file — the cover image is offered instead.'
      );
    }
    if (!videoUrl && parsed.hls.length === 0 && imageResolved) {
      notes.push('This pin carries no video, so the image is what Pinterest publishes for it.');
    }
    if (usedDirectLink) {
      notes.push('This file is served directly by the Pinterest CDN instead of being proxied through this site.');
    }

    return res.status(200).json({
      id,
      mediaType: videoUrl ? 'video' : 'photo',
      originalUrl: canonicalUrl,
      author: { username: handle, fullName: handle, avatar: '', isVerified: false },
      caption: parsed.title,
      timestamp: '',
      likes: '',
      comments: '',
      ...(duration ? { duration } : {}),
      provider: 'pinterest-public',
      ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
      items,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(502).json({ error: 'Could not read that Pinterest pin. Please try again in a minute.' });
  }
}
