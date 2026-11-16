import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the
// LinkedIn logic is inlined here. Keep it in sync with lib/linkedinExtract.ts,
// which is the source used by Cloudflare Pages Functions and server.ts.)

const LINKEDIN_ORIGIN = 'https://www.linkedin.com';
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const PROBE_TIMEOUT_MS = 5000;
const PAGE_ATTEMPTS = 3;
const MAX_IMAGES = 20;
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

function formatCount(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '';
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

function formatDate(iso: unknown): string {
  const value = typeof iso === 'string' ? iso.trim().substring(0, 40) : '';
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatIsoDuration(iso: unknown): string {
  const value = typeof iso === 'string' ? iso.trim() : '';
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return '';
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  if (hours + minutes + seconds === 0) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

// ---------- URL parsing ----------
const POST_HOSTS = new Set(['linkedin.com', 'www.linkedin.com', 'm.linkedin.com']);
const TYPE_NAMES: Record<string, 'activity' | 'share' | 'ugcPost'> = {
  activity: 'activity',
  share: 'share',
  ugcpost: 'ugcPost',
};
const URN_PATTERN = /urn(?::|%3A)li(?::|%3A)(activity|share|ugcpost)(?::|%3A)(\d{15,25})/i;
const SLUG_PATTERN = /-(activity|share|ugcpost)-(\d{15,25})(?:[-/]|$)/i;

function parsePostUrl(rawInput: string): { type: 'activity' | 'share' | 'ugcPost'; id: string } | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > 2048) return null;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!POST_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  let decoded = parsed.pathname + parsed.search;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw form; the patterns also accept %3A escapes.
  }

  const match = decoded.match(URN_PATTERN) ?? decoded.match(SLUG_PATTERN);
  if (!match) return null;
  const type = TYPE_NAMES[match[1].toLowerCase()];
  return type ? { type, id: match[2] } : null;
}

function postUrl(ref: { type: string; id: string }): string {
  return `${LINKEDIN_ORIGIN}/feed/update/urn:li:${ref.type}:${ref.id}/`;
}

function embedUrl(ref: { type: string; id: string }): string {
  return `${LINKEDIN_ORIGIN}/embed/feed/update/urn:li:${ref.type}:${ref.id}`;
}

// ---------- fetching ----------
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      'LinkedIn did not return this post. It may be deleted, private, or limited to signed-in members.',
      404
    );
  }
  if (status === 999 || status === 403 || status === 429) {
    return new HttpError(
      'LinkedIn refused the request from this server (HTTP ' +
        status +
        '). That is LinkedIn rate-limiting automated access — please try again in a few minutes.',
      503
    );
  }
  return new HttpError(`LinkedIn returned HTTP ${status} for this post. Please try again.`, 502);
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
      throw new HttpError('LinkedIn returned a page larger than expected. Please try again.', 502);
    }
    return html;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('LinkedIn did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function probeMedia(url: string): Promise<{ bytes: number | null; mime: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT, Referer: `${LINKEDIN_ORIGIN}/`, Accept: '*/*' },
      signal: controller.signal,
    });
    if (!response.ok) return { bytes: null, mime: '' };
    const length = Number(response.headers.get('content-length'));
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    return { bytes: Number.isFinite(length) && length > 0 ? length : null, mime };
  } catch {
    return { bytes: null, mime: '' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- HTML parsing ----------
interface Asset {
  key: string;
  url: string;
  variant: string;
  rank: number;
}

const LD_JSON_PATTERN = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
const POST_LD_TYPES = new Set(['SocialMediaPosting', 'DiscussionForumPosting']);
const VIDEO_URL_PATTERN = /https:\/\/dms\.licdn\.com\/playlist\/vid\/[^"'\\\s<>]+/g;
const IMAGE_PATH = /^\/dms\/image\/v2\/([^/]+)\/([^/]+)\//;
const VIDEO_PATH = /^\/playlist\/vid\/(?:v2\/)?([^/]+)\/([^/]+)\//;

function decodeHtml(text: string): string {
  return text
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().substring(0, max) : '';
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function imageRank(variant: string): number {
  if (!variant.startsWith('feedshare-')) return -1;
  if (variant.includes('thumbnail')) return -1;
  if (variant.includes('document-cover')) return -1;
  if (variant.includes('high-res')) return 10000;
  return Number(variant.match(/(\d{3,4})/)?.[1] ?? 0);
}

function videoRank(variant: string): number {
  if (!variant.startsWith('mp4-')) return -1;
  return Number(variant.match(/(\d{3,4})p/)?.[1] ?? 0);
}

function mediaUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'media.licdn.com' && host !== 'dms.licdn.com') return null;
    return url;
  } catch {
    return null;
  }
}

function collect(rawUrls: string[], pathPattern: RegExp, rankOf: (variant: string) => number): Asset[] {
  const assets = new Map<string, Asset>();
  for (const raw of rawUrls) {
    const url = mediaUrl(raw);
    if (!url) continue;
    const parts = url.pathname.match(pathPattern);
    if (!parts) continue;
    const [, key, variant] = parts;
    const rank = rankOf(variant);
    if (rank < 0) continue;
    const current = assets.get(key);
    if (!current || rank > current.rank) assets.set(key, { key, url: url.href, variant, rank });
  }
  return [...assets.values()];
}

function urlsOf(value: unknown): string[] {
  return []
    .concat(value ?? [])
    .map((entry: any) => (typeof entry === 'string' ? entry : entry?.contentUrl ?? entry?.url))
    .filter((entry: any): entry is string => typeof entry === 'string');
}

function interactionCount(node: any, action: string): unknown {
  const stats = [].concat(node?.interactionStatistic ?? []);
  for (const stat of stats) {
    if (String(stat?.interactionType).endsWith(action)) {
      const value = count(stat?.userInteractionCount);
      if (value !== null) return value;
    }
  }
  return action === 'CommentAction' ? node?.commentCount : null;
}

function handleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[1] ? decodeURIComponent(segments[1]).slice(0, 120) : '';
  } catch {
    return '';
  }
}

function normaliseAuthorUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!url.hostname.toLowerCase().endsWith('linkedin.com')) return '';
    return `${LINKEDIN_ORIGIN}${url.pathname}`;
  } catch {
    return '';
  }
}

interface ParsedPost {
  meta: {
    caption: string;
    authorName: string;
    authorUrl: string;
    avatar: string;
    published: string;
    likes: unknown;
    comments: unknown;
  };
  images: Asset[];
  videos: Asset[];
  hasMarkup: boolean;
  duration: string;
  videoWidth: number | null;
  videoHeight: number | null;
  videoThumb: string;
}

function parseHtml(html: string): ParsedPost {
  const decoded = decodeHtml(html);
  const parsed: ParsedPost = {
    meta: { caption: '', authorName: '', authorUrl: '', avatar: '', published: '', likes: null, comments: null },
    images: [],
    videos: [],
    hasMarkup: false,
    duration: '',
    videoWidth: null,
    videoHeight: null,
    videoThumb: '',
  };

  const jsonLdImages: string[] = [];
  const jsonLdVideos: string[] = [];

  for (const [, body] of decoded.matchAll(LD_JSON_PATTERN)) {
    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const nodes = [data].flat().flatMap((node: any) => [node, ...[].concat(node?.['@graph'] ?? [])]);
    for (const node of nodes) {
      const type = node?.['@type'];
      if (type === 'VideoObject') {
        parsed.hasMarkup = true;
        jsonLdVideos.push(str(node?.contentUrl, 900));
        parsed.duration = parsed.duration || formatIsoDuration(node?.duration);
        parsed.videoWidth = parsed.videoWidth ?? count(node?.width);
        parsed.videoHeight = parsed.videoHeight ?? count(node?.height);
        parsed.videoThumb = parsed.videoThumb || str(node?.thumbnailUrl, 900);
        const creator = node?.creator;
        parsed.meta.authorName = parsed.meta.authorName || str(creator?.name, 120);
        parsed.meta.authorUrl = parsed.meta.authorUrl || normaliseAuthorUrl(str(creator?.url, 300));
        parsed.meta.avatar = parsed.meta.avatar || str(creator?.image?.url, 600);
        parsed.meta.published = parsed.meta.published || str(node?.datePublished, 40);
        parsed.meta.likes = parsed.meta.likes ?? interactionCount(node, 'LikeAction');
        parsed.meta.comments = parsed.meta.comments ?? interactionCount(node, 'CommentAction');
        if (!parsed.meta.caption) {
          parsed.meta.caption = str(node?.description, 20000) || str(node?.headline, 20000);
        }
      } else if (POST_LD_TYPES.has(str(type, 40))) {
        parsed.hasMarkup = true;
        jsonLdImages.push(...urlsOf(node?.image));
        jsonLdVideos.push(...urlsOf(node?.video));
        parsed.meta.authorName = parsed.meta.authorName || str(node?.author?.name, 120);
        parsed.meta.authorUrl = parsed.meta.authorUrl || normaliseAuthorUrl(str(node?.author?.url, 300));
        parsed.meta.avatar = parsed.meta.avatar || str(node?.author?.image?.url, 600);
        parsed.meta.published = parsed.meta.published || str(node?.datePublished, 40);
        parsed.meta.likes = parsed.meta.likes ?? interactionCount(node, 'LikeAction');
        parsed.meta.comments = parsed.meta.comments ?? interactionCount(node, 'CommentAction');
        if (!parsed.meta.caption) {
          parsed.meta.caption = str(node?.articleBody, 20000) || str(node?.headline, 20000);
        }
      }
    }
  }

  const htmlVideos = [...decoded.matchAll(VIDEO_URL_PATTERN)].map((match) => match[0]);

  // Images come from the schema.org markup only: scanning the whole page would
  // also collect comment attachments and "more posts" artwork from the same CDN.
  parsed.images = collect(jsonLdImages, IMAGE_PATH, imageRank).slice(0, MAX_IMAGES);
  parsed.videos = collect(jsonLdVideos.length > 0 ? jsonLdVideos : htmlVideos, VIDEO_PATH, videoRank);

  return parsed;
}

function mergeAssets(current: Asset[], incoming: Asset[], limit: number): Asset[] {
  const merged = new Map<string, Asset>();
  for (const asset of [...current, ...incoming]) {
    const existing = merged.get(asset.key);
    if (!existing || asset.rank > existing.rank) merged.set(asset.key, asset);
  }
  return [...merged.values()].slice(0, limit);
}

function isProxyableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'licdn.com' || host.endsWith('.licdn.com');
}

// ---------- handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (checkRateLimit(req, 'linkedin', 30, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const rawUrl = String((req.query.url as string) || req.body?.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error:
        'Paste a public LinkedIn post link, for example https://www.linkedin.com/posts/name_slug-activity-1234567890123456789-abcd',
    });
  }
  if (rawUrl.length > 2048) return res.status(414).json({ error: 'URL is too long.' });

  const ref = parsePostUrl(rawUrl);
  if (!ref) {
    return res.status(400).json({
      error:
        'Paste a public LinkedIn post link, for example https://www.linkedin.com/posts/name_slug-activity-1234567890123456789-abcd',
    });
  }

  try {
    const canonical = postUrl(ref);

    // The embed view is small and rate-limited less aggressively, so it is read
    // first; a missing embed is not fatal because the post page may still answer.
    let embedParsed: ParsedPost | null = null;
    try {
      embedParsed = parseHtml(await fetchHtml(embedUrl(ref)));
    } catch {
      embedParsed = null;
    }

    // LinkedIn intermittently serves a shorter page without the schema.org
    // markup; ask again until it arrives.
    let best: ParsedPost | null = null;
    let lastError: HttpError | null = null;

    for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(400 * attempt);
      try {
        const page = parseHtml(await fetchHtml(canonical));
        if (!best) {
          best = page;
        } else {
          best = {
            ...best,
            meta: best.meta.caption ? best.meta : page.meta,
            images: mergeAssets(best.images, page.images, MAX_IMAGES),
            videos: mergeAssets(best.videos, page.videos, 8),
            hasMarkup: best.hasMarkup || page.hasMarkup,
            duration: best.duration || page.duration,
            videoWidth: best.videoWidth ?? page.videoWidth,
            videoHeight: best.videoHeight ?? page.videoHeight,
            videoThumb: best.videoThumb || page.videoThumb,
          };
        }
      } catch (error) {
        lastError = error instanceof HttpError ? error : new HttpError('Could not read that LinkedIn post.', 502);
        if (lastError.status !== 502) break;
      }
      if (best?.hasMarkup) break;
    }

    if (!best) throw lastError ?? new HttpError('Could not read that LinkedIn post. Please try again.', 502);

    const images = mergeAssets(best.images, embedParsed?.images ?? [], MAX_IMAGES);
    const videos = mergeAssets(best.videos, embedParsed?.videos ?? [], 8);

    if (videos.length === 0 && images.length === 0) {
      return res.status(404).json({
        error:
          'This LinkedIn post has no public video or images to download. Text-only posts, polls, document/PDF carousels and link-preview cards are not supported — open a post that has the media attached and paste its link.',
      });
    }

    const meta = best.meta.caption ? best.meta : embedParsed?.meta ?? best.meta;
    const handle = handleFromUrl(meta.authorUrl) || 'linkedin';
    const safeHandle = handle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'linkedin';
    const fileBase = `igsavego_linkedin_${ref.id}_${safeHandle}`;

    const video = videos[0];
    const imageAssets = images.slice(0, MAX_IMAGES);

    const [videoProbe, ...imageProbes] = await Promise.all([
      video ? probeMedia(video.url) : Promise.resolve({ bytes: null, mime: '' }),
      ...imageAssets.map((asset) => probeMedia(asset.url)),
    ]);

    const items: any[] = [];
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

    if (video) {
      const downloadUrl = proxied(video.url, `${fileBase}_video.mp4`);
      const dimensions =
        best.videoWidth && best.videoHeight ? `${best.videoWidth}:${best.videoHeight}` : '';
      const sizeLabel = formatBytes(videoProbe.bytes);
      items.push({
        id: `item_${ref.id}_video`,
        type: 'video',
        url: downloadUrl,
        downloadUrl,
        thumbnail: best.videoThumb,
        quality: 'Public post video',
        dimensions,
        fileSize: sizeLabel,
        format: 'mp4',
        availableQualities: [
          {
            id: 'original',
            label: 'Public post video (MP4)',
            quality: 'original',
            resolution: dimensions ? `Aspect ratio ${dimensions}` : '',
            fileSize: sizeLabel,
            downloadUrl,
            format: 'mp4',
            bitrate: 'File as published by LinkedIn',
          },
        ],
      });
    }

    imageAssets.forEach((asset, index) => {
      const probe = imageProbes[index] ?? { bytes: null, mime: '' };
      const format: 'jpg' | 'png' | 'webp' = probe.mime.includes('png')
        ? 'png'
        : probe.mime.includes('webp')
          ? 'webp'
          : 'jpg';
      const label = probe.mime ? `Image as published by LinkedIn (${format.toUpperCase()})` : 'Image as published by LinkedIn';
      const downloadUrl = proxied(asset.url, `${fileBase}_${index + 1}.${format}`);
      const sizeLabel = formatBytes(probe.bytes);
      items.push({
        id: `item_${ref.id}_${index + 1}`,
        type: 'photo',
        url: asset.url,
        downloadUrl,
        thumbnail: asset.url,
        quality: `${format.toUpperCase()} image`,
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
    });

    return res.status(200).json({
      id: ref.id,
      mediaType: video ? 'video' : 'photo',
      originalUrl: canonical,
      author: {
        username: handle,
        fullName: meta.authorName || handle,
        avatar: meta.avatar,
        isVerified: false,
      },
      caption: meta.caption ? meta.caption.substring(0, MAX_TEXT) : `LinkedIn post by ${meta.authorName || handle}`,
      timestamp: formatDate(meta.published),
      likes: formatCount(meta.likes),
      comments: formatCount(meta.comments),
      ...(best.duration ? { duration: best.duration } : {}),
      provider: 'linkedin-public',
      ...(usedDirectLink
        ? { note: 'This file is served directly by the LinkedIn CDN instead of being proxied through this site.' }
        : {}),
      items,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(502).json({ error: 'Could not read that LinkedIn post. Please try again in a minute.' });
  }
}
