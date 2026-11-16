// Pinterest public-pin media extractor shared by every host:
//   - functions/api/pinterest.ts  (Cloudflare Pages Functions)
//   - api/pinterest.ts            (Vercel, inlined copy)
//   - server.ts                   (Express dev / Docker)
//
// What Pinterest actually exposes (verified against live public pins):
//   https://www.pinterest.com/pin/<id>/  needs no cookie, no login and no API
//   key for public pins. The server-rendered HTML embeds the pin record, which
//   carries:
//     "videos":{"videoUrls":["https://v1.pinimg.com/videos/mc/720p/…mp4",
//                            "https://v1.pinimg.com/videos/iht/720p/…mp4",
//                            "https://v1.pinimg.com/videos/iht/hls/…m3u8", …]}
//     Older pins list /videos/mc/ progressive MP4s. Newer ones list only
//     /videos/iht/ renditions (AV1, HEVC, HLS, DASH) — no H.264 MP4 at all.
//     Pinterest still serves the plain H.264 720p file for any rendition hash:
//     /videos/iht/720p/<aa>/<bb>/<cc>/<hash>.mp4   (verified 200, video/mp4).
//     "imageSignature":"<hash>"  — the pin's own image, present at
//                                  https://i.pinimg.com/originals/xx/yy/zz/<hash>.jpg
//     "gridTitle" / "seoTitle"   — the pin's title
//     "pinner":{"…"username"…}   — the author
//   Progressive MP4s are therefore available for video pins; HLS playlists are
//   ignored because they are not a single downloadable file.
//
// Two honest limits are encoded on purpose:
//   1. Pins whose renditions are HLS/DASH only (no MP4 at all) return the
//      cover image with a note instead of an invented video.
//   2. Private boards, secret pins and deleted pins are not reachable without a
//      session, so they are reported as errors rather than promised.
//
// Only v1.pinimg.com (video) and i.pinimg.com (images) are fetched after the
// pin page itself, and the pin id is re-parsed before any request, so user
// input can never choose the fetch target.
//
// Dependency-free: uses only `fetch`, so the same code runs on Workers (no Node
// builtins) and on Node 24.

import { formatBytes, formatCount } from './mediaFormat';

export const PINTEREST_ORIGIN = 'https://www.pinterest.com';

const MAX_INPUT = 2048;
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const PROBE_TIMEOUT_MS = 6000;
const PAGE_ATTEMPTS = 2;
const MAX_TEXT = 600;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export class PinterestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PinterestError';
    this.status = status;
  }
}

export interface PinterestPinRef {
  /** Numeric pin id, e.g. 664281013778109217. */
  id: string;
  /** Set for pin.it short links, resolved with one redirect before fetching. */
  shortCode?: string;
}

export interface PinterestAsset {
  id: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  quality: string;
  dimensions: string;
  fileSize: string;
  format: 'mp4' | 'jpg' | 'png' | 'webp';
  availableQualities: {
    id: string;
    label: string;
    quality: 'original';
    resolution: string;
    fileSize: string;
    downloadUrl: string;
    format: 'mp4' | 'jpg' | 'png' | 'webp';
    bitrate?: string;
  }[];
}

export interface PinterestResult {
  id: string;
  mediaType: 'video' | 'photo';
  originalUrl: string;
  author: {
    username: string;
    fullName: string;
    avatar: string;
    isVerified: boolean;
  };
  caption: string;
  timestamp: string;
  likes: string;
  comments: string;
  duration?: string;
  provider: 'pinterest-public';
  note?: string;
  items: PinterestAsset[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

const PIN_PATH = /\/pin\/(?:[\w-]{1,120}--)?(\d{6,25})(?:[/?#]|$)/i;
const SHORT_PATH = /^\/([A-Za-z0-9]{3,40})\/?$/;

/**
 * Accepts the link shapes Pinterest hands out:
 *   https://www.pinterest.com/pin/664281013778109217/
 *   https://www.pinterest.com/pin/some-slug--664281013778109217/
 *   https://de.pinterest.com/pin/664281013778109217/   (country subdomain)
 *   https://pin.it/3AxJbLdcH                            (short link)
 *   a bare numeric pin id
 * Profile, board and search links are rejected so the UI can say what is
 * supported instead of guessing.
 */
export function parsePinterestPinUrl(rawInput: string): PinterestPinRef | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > MAX_INPUT) return null;

  if (/^\d{6,25}$/.test(input)) return { id: input };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  // Country domains (de.pinterest.com, pinterest.co.uk, pinterest.fr, ...) hand
  // out the same pin ids. Only the id is kept: the fetch target is rebuilt as
  // www.pinterest.com/pin/<id>/, so the input host is never contacted.
  const isPinterest = /^(?:[a-z]{2,3}\.)?pinterest\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(
    host
  );
  const isShort = host === 'pin.it' || host.endsWith('.pin.it');

  if (isShort) {
    const match = parsed.pathname.match(SHORT_PATH);
    return match ? { id: '', shortCode: match[1] } : null;
  }
  if (!isPinterest) return null;

  const match = parsed.pathname.match(PIN_PATH);
  return match ? { id: match[1] } : null;
}

export function pinterestPinUrl(id: string): string {
  return `${PINTEREST_ORIGIN}/pin/${id}/`;
}

/** Hosts the /api/proxy-media allowlist accepts for Pinterest results. */
export function isProxyablePinterestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'pinimg.com' || host.endsWith('.pinimg.com');
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pinterestErrorFor(status: number): PinterestError {
  if (status === 404 || status === 410) {
    return new PinterestError(
      'Pinterest did not return this pin. It may be deleted, secret, or limited to signed-in members.',
      404
    );
  }
  if (status === 403 || status === 429) {
    return new PinterestError(
      'Pinterest refused the request from this server (HTTP ' +
        status +
        '). That is Pinterest rate-limiting automated access — please try again in a few minutes.',
      503
    );
  }
  return new PinterestError(`Pinterest returned HTTP ${status} for this pin. Please try again.`, 502);
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
    if (!response.ok) throw pinterestErrorFor(response.status);
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      throw new PinterestError('Pinterest returned a page larger than expected. Please try again.', 502);
    }
    return html;
  } catch (error) {
    if (error instanceof PinterestError) throw error;
    throw new PinterestError('Pinterest did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

/** Follow a pin.it redirect and read the numeric id out of the final URL. */
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
    if (!match) {
      throw new PinterestError(
        'That pin.it link did not lead to a Pinterest pin. Open the pin itself and copy its full link.',
        404
      );
    }
    return match[1];
  } catch (error) {
    if (error instanceof PinterestError) throw error;
    throw new PinterestError('Could not follow that pin.it link. Please paste the full pin URL instead.', 400);
  } finally {
    clearTimeout(timer);
  }
}

interface Probe {
  bytes: number | null;
  mime: string;
  ok: boolean;
}

async function probeMedia(url: string): Promise<Probe> {
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
    return {
      bytes: Number.isFinite(length) && length > 0 ? length : null,
      mime,
      ok: response.ok,
    };
  } catch {
    return { bytes: null, mime: '', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

const STOP_CHARS = new Set(['"', "'", '\\', ' ', '<', '>', ')', ',', ']', '}']);

/**
 * Collect every URL under `prefix`, stopping at the first JSON/HTML delimiter.
 * Scanning starts AFTER the prefix: a prefix that begins with a delimiter (the
 * JSON string markers used below do) would otherwise never advance and spin.
 */
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

/** Every `"key":"value"` string on the page, honouring JSON escapes. */
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

/** Read one `"key":"value"` string from the embedded JSON, honouring escapes. */
function jsonString(html: string, key: string): string {
  return allJsonStrings(html, key)[0] || '';
}

const UI_WORDS = new Set([
  'saves',
  'save',
  'comments',
  'comment',
  'follow',
  'share',
  'like',
  'likes',
  'pins',
  'more',
]);

/**
 * Pinterest ships several titles for one pin. `gridTitle` is the pin's own
 * title; `seoTitle` is a decorated variant ("[Видео] «Origami» | …") that reads
 * badly in a download card.
 */
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

/** `…/564x/ab/cd/ef/<hash>.jpg` -> `…/originals/ab/cd/ef/<hash>.jpg` */
function toOriginalImage(url: string): string {
  return url.replace(/\/(?:\d+x|originals)\//, '/originals/');
}

function durationLabel(ms: number | null): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface ParsedPin {
  title: string;
  pinner: string;
  /** Rendition hash, e.g. 420de0dc1d7ce9ddcc883684ba3948a4, when present. */
  videoHash: string;
  mp4s: string[];
  hls: string[];
  images: string[];
  /** Width/height/duration immediately preceding a URL in the pin record. */
  metaFor: (url: string) => { width: number | null; height: number | null; durationMs: number | null };
}

/** Extracts the media and metadata the pin page already contains. */
export function parsePinterestHtml(html: string, id: string): ParsedPin {
  const signature = jsonString(html, 'imageSignature');
  const pinnerMatch = html.match(/"pinner":\{[^}]*"username":"([^"]{1,120})"/);

  // Images are keyed by the pin's own signature: the page also carries site
  // artwork and other pins' thumbnails on the same CDN, which would otherwise
  // be offered as if they belonged to this pin.
  const images = signature
    ? urlsWith(html, 'https://i.pinimg.com/').filter((url) => url.includes(signature))
    : [];

  // Video pins link their renditions under /videos/mc/ (progressive MP4) or
  // /videos/iht/ (AV1/HEVC MP4, HLS, DASH). Collect both; the rendition hash is
  // kept so the H.264 file can be addressed directly in extractPinterestPin.
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
    images,
    metaFor: (url: string) => {
      // In the pin record the shape is
      //   {"duration":57700,"height":1920,"width":1080,"url":"…mp4"}
      // so the numbers sit just before the URL.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a public Pinterest pin URL into a download descriptor.
 * Throws PinterestError with a user-facing message on any failure.
 */
export async function extractPinterestPin(rawUrl: string): Promise<PinterestResult> {
  const ref = parsePinterestPinUrl(rawUrl);
  if (!ref) {
    throw new PinterestError(
      'Paste a public Pinterest pin link, for example https://www.pinterest.com/pin/664281013778109217/',
      400
    );
  }

  const id = ref.id || (await resolveShortLink(ref.shortCode || ''));
  const canonicalUrl = pinterestPinUrl(id);

  let html = '';
  let lastError: PinterestError | null = null;
  for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
    try {
      html = await fetchHtml(canonicalUrl);
      break;
    } catch (error) {
      lastError = error instanceof PinterestError ? error : new PinterestError('Could not read that pin.', 502);
      // 404 / 503 will not improve by asking again.
      if (lastError.status !== 502) break;
    }
  }
  if (!html) {
    throw lastError ?? new PinterestError('Could not read that Pinterest pin. Please try again.', 502);
  }

  const parsed = parsePinterestHtml(html, id);

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
  let videoProbe: Probe = { bytes: null, mime: '', ok: false };
  for (const candidate of videoCandidates) {
    const probe = await probeMedia(candidate);
    if (probe.ok && probe.mime.startsWith('video/')) {
      videoUrl = candidate;
      videoProbe = probe;
      break;
    }
  }

  if (!videoUrl && !imageUrl) {
    throw new PinterestError(
      'This Pinterest pin has no public video or image to download. Hidden or secret pins, and pins that only link to another website, cannot be extracted — open a pin that contains the media itself and paste its link.',
      404
    );
  }

  // One HEAD for the image: real size and content type from the CDN, or nothing.
  const imageProbe = originalImage
    ? await probeMedia(originalImage)
    : imageUrl
      ? await probeMedia(imageUrl)
      : ({ bytes: null, mime: '', ok: false } as Probe);

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
    if (!isProxyablePinterestHost(host)) {
      usedDirectLink = true;
      return source;
    }
    return `/api/proxy-media?url=${encodeURIComponent(source)}&filename=${encodeURIComponent(filename)}`;
  };

  const items: PinterestAsset[] = [];
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
      'Pinterest exposed only a streaming playlist (HLS/DASH) for this pin, which is not a single file — the cover image is offered instead.'
    );
  }
  if (videoUrl && /(?:av1Mp4|hevcMp4|\/h265)/i.test(videoUrl)) {
    notes.push(
      'Pinterest published this pin in AV1/HEVC only; the MP4 downloads fine but some players need a codec pack to preview it.'
    );
  }
  if (!videoUrl && parsed.hls.length === 0 && imageResolved) {
    notes.push('This pin carries no video, so the image is what Pinterest publishes for it.');
  }
  if (usedDirectLink) {
    notes.push('This file is served directly by the Pinterest CDN instead of being proxied through this site.');
  }

  return {
    id,
    mediaType: videoUrl ? 'video' : 'photo',
    originalUrl: canonicalUrl,
    author: {
      username: handle,
      fullName: handle,
      avatar: '',
      isVerified: false,
    },
    caption: parsed.title,
    timestamp: '',
    likes: formatCount(null),
    comments: formatCount(null),
    ...(duration ? { duration } : {}),
    provider: 'pinterest-public',
    ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    items,
  };
}
