// LinkedIn public-post media extractor shared by every host:
//   - functions/api/linkedin.ts  (Cloudflare Pages Functions)
//   - api/linkedin.ts            (Vercel)
//   - server.ts                  (Express dev / Docker)
//
// How LinkedIn exposes the file (verified against live public posts):
//   A post permalink such as
//     https://www.linkedin.com/posts/name_slug-activity-<id>-<hash>
//   maps to a guest-viewable page at
//     https://www.linkedin.com/feed/update/urn:li:<type>:<id>/
//   which needs no cookie, no login and no API key. That page carries
//   schema.org JSON-LD (`VideoObject` for video posts, `SocialMediaPosting` or
//   `DiscussionForumPosting` for image posts) plus the signed CDN URLs:
//     - video : https://dms.licdn.com/playlist/vid/.../mp4-<height>p-.../file
//     - images: https://media.licdn.com/dms/image/.../feedshare-.../file
//   Both CDNs return `Access-Control-Allow-Origin: *` and serve the file
//   straight to a browser. Stronger still, `VideoObject.contentUrl` *is* the
//   MP4 LinkedIn generated for playback, so what we hand over is the file the
//   platform publishes — not a screen recording and not a re-encode.
//
//   Two honest limits are encoded here on purpose:
//     1. A guest page only lists the media it chooses to render, and LinkedIn
//        sometimes serves a shorter page that carries the first image only.
//        The extractor retries and keeps the richest response; it never
//        fabricates the missing items.
//     2. Anything behind the login wall (private posts, Sales Navigator,
//        Learning courses, member-only video) simply is not reachable through
//        a public endpoint, so it is reported as an error instead of being
//        promised.
//
// No API key, no login, no cookies. The only upstream hosts contacted are
// www.linkedin.com and, for sizes, the two licdn.com CDN hosts, so user input
// can never choose the fetch target: the post URL is rebuilt from the numeric
// id that was parsed out of the link.
//
// This module is dependency-free and uses only `fetch`, so the same code runs
// on Workers (no Node builtins) and on Node 24.

import { formatBytes, formatCount, formatDate, formatIsoDuration } from './mediaFormat';

export const LINKEDIN_ORIGIN = 'https://www.linkedin.com';

const MAX_INPUT = 2048;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const PROBE_TIMEOUT_MS = 5000;
const PAGE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;
const MAX_TEXT = 600;
const MAX_IMAGES = 20;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export class LinkedInError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'LinkedInError';
    this.status = status;
  }
}

export type LinkedInPostType = 'activity' | 'share' | 'ugcPost';

export interface LinkedInPostRef {
  type: LinkedInPostType;
  /** Numeric activity id; 15-25 digits. */
  id: string;
}

export interface LinkedInQuality {
  id: string;
  label: string;
  quality: 'original';
  resolution: string;
  fileSize: string;
  downloadUrl: string;
  format: 'mp4' | 'jpg' | 'png' | 'webp';
  bitrate?: string;
}

export interface LinkedInItem {
  id: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  quality: string;
  dimensions: string;
  fileSize: string;
  format: 'mp4' | 'jpg' | 'png' | 'webp';
  availableQualities: LinkedInQuality[];
}

export interface LinkedInResult {
  id: string;
  mediaType: 'video' | 'photo';
  originalUrl: string;
  author: {
    username: string;
    fullName: string;
    avatar: string;
    isVerified: boolean;
    followers?: string;
  };
  caption: string;
  timestamp: string;
  likes: string;
  comments: string;
  duration?: string;
  provider: 'linkedin-public';
  note?: string;
  items: LinkedInItem[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

const POST_HOSTS = new Set(['linkedin.com', 'www.linkedin.com', 'm.linkedin.com']);
const TYPE_NAMES: Record<string, LinkedInPostType> = {
  activity: 'activity',
  share: 'share',
  ugcpost: 'ugcPost',
};

const URN_PATTERN = /urn(?::|%3A)li(?::|%3A)(activity|share|ugcpost)(?::|%3A)(\d{15,25})/i;
const SLUG_PATTERN = /-(activity|share|ugcpost)-(\d{15,25})(?:[-/]|$)/i;

/**
 * Accepts the link shapes LinkedIn actually hands out:
 *   https://www.linkedin.com/posts/<author>_<slug>-activity-<id>-<hash>
 *   https://www.linkedin.com/feed/update/urn:li:activity:<id>/
 *   https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A<id>
 *   https://m.linkedin.com/posts/... (mobile)
 * Profile, company, school, jobs, feed and Learning URLs are rejected so the
 * UI can say what is supported instead of guessing.
 */
export function parseLinkedInPostUrl(rawInput: string): LinkedInPostRef | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > MAX_INPUT) return null;

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
  if (!type) return null;
  return { type, id: match[2] };
}

export function linkedInPostUrl({ type, id }: LinkedInPostRef): string {
  return `${LINKEDIN_ORIGIN}/feed/update/urn:li:${type}:${id}/`;
}

export function linkedInEmbedUrl({ type, id }: LinkedInPostRef): string {
  return `${LINKEDIN_ORIGIN}/embed/feed/update/urn:li:${type}:${id}`;
}

/** Hosts the /api/proxy-media allowlist accepts. */
export function isProxyableLinkedInHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'licdn.com' || host.endsWith('.licdn.com');
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function linkedInErrorFor(status: number): LinkedInError {
  if (status === 404 || status === 410) {
    return new LinkedInError(
      'LinkedIn did not return this post. It may be deleted, private, or limited to signed-in members.',
      404
    );
  }
  if (status === 999 || status === 403 || status === 429) {
    return new LinkedInError(
      'LinkedIn refused the request from this server (HTTP ' +
        status +
        '). That is LinkedIn rate-limiting automated access — please try again in a few minutes.',
      503
    );
  }
  return new LinkedInError(`LinkedIn returned HTTP ${status} for this post. Please try again.`, 502);
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
    if (!response.ok) throw linkedInErrorFor(response.status);
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      throw new LinkedInError('LinkedIn returned a page larger than expected. Please try again.', 502);
    }
    return html;
  } catch (error) {
    if (error instanceof LinkedInError) throw error;
    throw new LinkedInError('LinkedIn did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

interface Probe {
  bytes: number | null;
  mime: string;
}

/** HEAD the CDN file so the card can show a real size and format. */
async function probeMedia(url: string): Promise<Probe> {
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

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

interface Asset {
  /** Stable identity inside the CDN path: one uploaded file can have many variants. */
  key: string;
  url: string;
  /** Variant folder, e.g. `feedshare-image-high-res` or `mp4-720p-30fp-crf28`. */
  variant: string;
  /** Higher is better; used to keep the largest copy of one asset. */
  rank: number;
}

interface PostMeta {
  caption: string;
  authorName: string;
  authorUrl: string;
  avatar: string;
  published: string;
  likes: unknown;
  comments: unknown;
}

interface ParsedPost {
  meta: PostMeta;
  images: Asset[];
  videos: Asset[];
  /** True when the page carried schema.org post/video markup. */
  hasMarkup: boolean;
  duration: string;
  videoWidth: number | null;
  videoHeight: number | null;
  videoThumb: string;
}

const LD_JSON_PATTERN = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
const POST_LD_TYPES = new Set(['SocialMediaPosting', 'DiscussionForumPosting']);

const IMAGE_URL_PATTERN = /https:\/\/media\.licdn\.com\/dms\/image\/[^"'\\\s<>]+/g;
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

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().substring(0, max) : '';
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Images: only the post's own `feedshare-*` renders count. Profile photos,
 * company logos, article covers, comment attachments, video thumbnails and
 * document-carousel covers live on the same host and would otherwise be
 * offered as if they were attached to the post.
 */
function imageRank(variant: string): number {
  if (!variant.startsWith('feedshare-')) return -1;
  if (variant.includes('thumbnail')) return -1;
  if (variant.includes('document-cover')) return -1;
  if (variant.includes('high-res')) return 10000;
  const size = Number(variant.match(/(\d{3,4})/)?.[1] ?? 0);
  return size;
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

/** Keeps first-seen order per asset while upgrading to its largest variant. */
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
    if (!current || rank > current.rank) {
      assets.set(key, { key, url: url.href, variant, rank });
    }
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

/** `/in/name-123` -> `name-123`, so the card can show a handle-like username. */
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

/** Extracts the schema.org markup and the signed CDN paths from one page. */
export function parseLinkedInHtml(html: string): ParsedPost {
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
        jsonLdVideos.push(text(node?.contentUrl, 900));
        parsed.duration = parsed.duration || formatIsoDuration(node?.duration);
        parsed.videoWidth = parsed.videoWidth ?? count(node?.width);
        parsed.videoHeight = parsed.videoHeight ?? count(node?.height);
        parsed.videoThumb = parsed.videoThumb || text(node?.thumbnailUrl, 900);
        const creator = node?.creator;
        parsed.meta.authorName = parsed.meta.authorName || text(creator?.name, 120);
        parsed.meta.authorUrl = parsed.meta.authorUrl || normaliseAuthorUrl(text(creator?.url, 300));
        parsed.meta.avatar = parsed.meta.avatar || text(creator?.image?.url, 600);
        parsed.meta.published = parsed.meta.published || text(node?.datePublished, 40);
        parsed.meta.likes = parsed.meta.likes ?? interactionCount(node, 'LikeAction');
        parsed.meta.comments = parsed.meta.comments ?? interactionCount(node, 'CommentAction');
        if (!parsed.meta.caption) {
          // `description` is the full post text; `headline`/`name` are the
          // truncated first line and the "… | Author | N comments" summary.
          parsed.meta.caption = text(node?.description, 20000) || text(node?.headline, 20000);
        }
      } else if (POST_LD_TYPES.has(text(type, 40))) {
        parsed.hasMarkup = true;
        jsonLdImages.push(...urlsOf(node?.image));
        jsonLdVideos.push(...urlsOf(node?.video));
        parsed.meta.authorName = parsed.meta.authorName || text(node?.author?.name, 120);
        parsed.meta.authorUrl = parsed.meta.authorUrl || normaliseAuthorUrl(text(node?.author?.url, 300));
        parsed.meta.avatar = parsed.meta.avatar || text(node?.author?.image?.url, 600);
        parsed.meta.published = parsed.meta.published || text(node?.datePublished, 40);
        parsed.meta.likes = parsed.meta.likes ?? interactionCount(node, 'LikeAction');
        parsed.meta.comments = parsed.meta.comments ?? interactionCount(node, 'CommentAction');
        if (!parsed.meta.caption) {
          parsed.meta.caption = text(node?.articleBody, 20000) || text(node?.headline, 20000);
        }
      }
    }
  }

  const htmlVideos = [...decoded.matchAll(VIDEO_URL_PATTERN)].map((match) => match[0]);

  // Images come from the schema.org markup only. Scanning the whole page would
  // also pick up comment attachments and artwork from the "more posts"
  // modules, which are on the same CDN and look identical.
  parsed.images = collect(jsonLdImages, IMAGE_PATH, imageRank).slice(0, MAX_IMAGES);
  // The video is unambiguous (one MP4 per post), so a page-level fallback is
  // safe when the markup is missing.
  parsed.videos = collect(jsonLdVideos.length > 0 ? jsonLdVideos : htmlVideos, VIDEO_PATH, videoRank);

  return parsed;
}

/** The embed view shows "+N" when it renders only the first few images. */
export function hiddenImageCount(html: string): number {
  const value = Number(String(html || '').match(/>\s*\+\s*(\d{1,3})\s*</)?.[1] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function mergeAssets(current: Asset[], incoming: Asset[], limit: number): Asset[] {
  const merged = new Map<string, Asset>();
  for (const asset of [...current, ...incoming]) {
    const existing = merged.get(asset.key);
    if (!existing || asset.rank > existing.rank) merged.set(asset.key, asset);
  }
  return [...merged.values()].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a public LinkedIn post URL into a download descriptor.
 * Throws LinkedInError with a user-facing message on any failure.
 */
export async function extractLinkedInPost(rawUrl: string): Promise<LinkedInResult> {
  const ref = parseLinkedInPostUrl(rawUrl);
  if (!ref) {
    throw new LinkedInError(
      'Paste a public LinkedIn post link, for example https://www.linkedin.com/posts/name_slug-activity-1234567890123456789-abcd',
      400
    );
  }

  const canonicalUrl = linkedInPostUrl(ref);

  // The embed view is small and never rate-limited as hard as the full page,
  // so it is asked first: it tells us how many images the post really has.
  let embedHtml = '';
  try {
    embedHtml = await fetchHtml(linkedInEmbedUrl(ref));
  } catch {
    // A missing embed is not fatal; the post page may still answer.
  }
  const embedParsed = embedHtml ? parseLinkedInHtml(embedHtml) : null;
  const expectedImages = Math.min(
    MAX_IMAGES,
    (embedParsed?.images.length ?? 0) + hiddenImageCount(embedHtml)
  );

  // LinkedIn intermittently serves a shorter page without the schema.org
  // markup (roughly 135 KB instead of ~400 KB). Ask again until the markup
  // arrives, which is also what carries the video and the post metadata.
  let best: ParsedPost | null = null;
  let lastError: LinkedInError | null = null;

  for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const page = parseLinkedInHtml(await fetchHtml(canonicalUrl));
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
      if (error instanceof LinkedInError) {
        lastError = error;
        // 404 / 503 will not improve by asking again.
        if (error.status !== 502) break;
      } else {
        lastError = new LinkedInError('Could not read that LinkedIn post. Please try again.', 502);
      }
    }

    if (best?.hasMarkup) break;
  }

  if (!best) {
    throw lastError ?? new LinkedInError('Could not read that LinkedIn post. Please try again.', 502);
  }

  const media = {
    images: mergeAssets(best.images, embedParsed?.images ?? [], MAX_IMAGES),
    videos: mergeAssets(best.videos, embedParsed?.videos ?? [], 8),
  };
  const hidden = hiddenImageCount(embedHtml);

  if (media.videos.length === 0 && media.images.length === 0) {
    throw new LinkedInError(
      'This LinkedIn post has no public video or images to download. Text-only posts, polls, document/PDF carousels and link-preview cards are not supported — open a post that has the media attached and paste its link.',
      404
    );
  }

  const meta = best.meta.caption ? best.meta : embedParsed?.meta ?? best.meta;
  const handle = handleFromUrl(meta.authorUrl) || 'linkedin';
  const safeHandle = handle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'linkedin';
  const fileBase = `igsavego_linkedin_${ref.id}_${safeHandle}`;

  const video = media.videos[0];
  const imageAssets = media.images.slice(0, MAX_IMAGES);

  // One HEAD per file: the size and the real content type, straight from the
  // CDN. Failures leave the field empty rather than guessing a format.
  const [videoProbe, ...imageProbes] = await Promise.all([
    video ? probeMedia(video.url) : Promise.resolve({ bytes: null, mime: '' } as Probe),
    ...imageAssets.map((asset) => probeMedia(asset.url)),
  ]);

  const items: LinkedInItem[] = [];
  let usedDirectLink = false;

  const proxied = (source: string, filename: string): string => {
    let host = '';
    try {
      host = new URL(source).hostname;
    } catch {
      host = '';
    }
    if (!isProxyableLinkedInHost(host)) {
      usedDirectLink = true;
      return source;
    }
    return `/api/proxy-media?url=${encodeURIComponent(source)}&filename=${encodeURIComponent(filename)}`;
  };

  if (video) {
    const format: 'mp4' = 'mp4';
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
      format,
      availableQualities: [
        {
          id: 'original',
          label: 'Public post video (MP4)',
          quality: 'original',
          resolution: dimensions ? `Aspect ratio ${dimensions}` : '',
          fileSize: sizeLabel,
          downloadUrl,
          format,
          bitrate: 'File as published by LinkedIn',
        },
      ],
    });
  }

  imageAssets.forEach((asset, index) => {
    const probe = imageProbes[index] ?? { bytes: null, mime: '' };
    const mime = probe.mime;
    const format: 'jpg' | 'png' | 'webp' = mime.includes('png')
      ? 'png'
      : mime.includes('webp')
        ? 'webp'
        : 'jpg';
    const label = mime ? `Image as published by LinkedIn (${format.toUpperCase()})` : 'Image as published by LinkedIn';
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

  const caption = meta.caption ? meta.caption.substring(0, MAX_TEXT) : `LinkedIn post by ${meta.authorName || handle}`;
  // Say so when LinkedIn itself advertises more images than its logged-out
  // view renders, instead of implying the post only had this many.
  const notes: string[] = [];
  if (hidden > 0) {
    notes.push(
      `LinkedIn's public view rendered ${media.images.length} image${media.images.length === 1 ? '' : 's'} and indicates ${hidden} more that only the app shows.`
    );
  }
  if (usedDirectLink) {
    notes.push('This file is served directly by the LinkedIn CDN instead of being proxied through this site.');
  }
  const note = notes.length > 0 ? notes.join(' ') : undefined;

  return {
    id: ref.id,
    mediaType: video ? 'video' : 'photo',
    originalUrl: canonicalUrl,
    author: {
      username: handle,
      fullName: meta.authorName || handle,
      avatar: meta.avatar,
      isVerified: false,
    },
    caption,
    timestamp: formatDate(meta.published),
    likes: formatCount(meta.likes),
    comments: formatCount(meta.comments),
    ...(best.duration ? { duration: best.duration } : {}),
    provider: 'linkedin-public',
    ...(note ? { note } : {}),
    items,
  };
}
