// X (formerly Twitter) public-post media extractor shared by every host:
//   - functions/api/twitter.ts   (Cloudflare Pages Functions)
//   - api/twitter.ts             (Vercel, inlined copy)
//   - server.ts                  (Express dev / Docker)
//
// What X actually exposes without a login, a cookie or an API key (verified
// against live public posts, including NASA photo posts and older video posts):
//
//   https://cdn.syndication.twimg.com/tweet-result?id=<id>&lang=en&token=<t>
//   is the endpoint behind X's own embedded-tweet widget. It is public, needs
//   no account, and returns the post as JSON:
//     __typename       "Tweet", or "TweetTombstone" (deleted / protected)
//     text, created_at, favorite_count, conversation_count
//     user             { name, screen_name, profile_image_url_https }
//     mediaDetails[]   { type: "photo" | "video" | "animated_gif",
//                        media_url_https,  // photo file or video poster
//                        original_info: { width, height },
//                        video_info: { duration_millis,
//                                      variants: [{ content_type, bitrate, url }] } }
//
//   `token` is a non-secret value X's embed script derives from the post id:
//     ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
//   The same formula (with the same floating-point rounding) is used by X's
//   embed widget and by yt-dlp's public timeline client. A post is therefore
//   fetched from its numeric id alone; the pasted link can never choose the
//   host this server talks to.
//
//   Photos: `media_url_https` + "?name=orig" is the original upload (verified
//   larger than the 4096 and large variants). The real byte size comes from a
//   HEAD request, so the card never guesses.
//   Videos: variants list several progressive MP4s named by their pixel size in
//   the path (…/1280x720/….mp4) plus an HLS playlist. Only MP4s are offered:
//   an m3u8 is not a single downloadable file. The largest responding MP4 is
//   used and its size is measured, never invented.
//
// Honest limits encoded on purpose:
//   1. Deleted, protected and withheld posts return an error, not a result.
//   2. Text-only posts and quote-post links have no media of their own; the
//      message says so instead of promising a file.
//   3. No resolution menu is invented: X publishes fixed renditions, and the
//      card shows the one being offered with its measured size.
//
// Dependency-free: uses only `fetch`, so the same code runs on Workers (no Node
// builtins) and on Node 24.

import { formatBytes, formatCount, formatDate } from './mediaFormat';

export const TWITTER_CDN = 'https://cdn.syndication.twimg.com';

const MAX_INPUT = 2048;
const FETCH_TIMEOUT_MS = 12000;
const PROBE_TIMEOUT_MS = 6000;
const MAX_TEXT = 600;
const MAX_PHOTOS = 4;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class TwitterError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'TwitterError';
    this.status = status;
  }
}

export interface TwitterPostRef {
  /** Numeric post id, e.g. 2051361508181856362. */
  id: string;
}

export interface TwitterAsset {
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

export interface TwitterResult {
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
  provider: 'x-public';
  note?: string;
  items: TwitterAsset[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

const STATUS_PATH = /\/status(?:es)?\/(\d{15,25})(?:[/?#]|$)/i;
const ID_ONLY = /^\d{15,25}$/;

/**
 * Accepts the link shapes X hands out:
 *   https://x.com/NASA/status/2051361508181856362
 *   https://twitter.com/NASA/status/2051361508181856362?s=20
 *   https://mobile.twitter.com/NASA/status/2051361508181856362
 *   https://x.com/i/web/status/2051361508181856362
 *   https://x.com/NASA/status/2051361508181856362/photo/1
 *   https://x.com/NASA/status/2051361508181856362/video/1
 *   a bare numeric post id
 * Profiles, hashtags, search, lists and t.co share links are rejected so the
 * page can explain what is supported instead of guessing at a target.
 */
export function parseTwitterPostUrl(rawInput: string): TwitterPostRef | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > MAX_INPUT) return null;

  if (ID_ONLY.test(input)) return { id: input };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  // Only the X/Twitter web hosts. t.co short links are rejected on purpose:
  // following them would let an arbitrary destination be fetched, and X's own
  // "copy link" action always gives an x.com URL.
  const isTwitterHost =
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host === 'twitter.com' ||
    host.endsWith('.twitter.com');
  if (!isTwitterHost) return null;

  const match = parsed.pathname.match(STATUS_PATH);
  return match ? { id: match[1] } : null;
}

/** Canonical link stored in the result and offered as "view original". */
export function twitterPostUrl(id: string): string {
  return `https://x.com/i/status/${id}`;
}

/**
 * Statuses were public at the time of writing; the token is derived exactly as
 * X's own embed widget derives it (float rounding included, which the endpoint
 * accepts).
 */
export function tweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  media_url_https: string;
  original_info?: { width?: number; height?: number };
  sizes?: Record<string, { w?: number; h?: number }>;
  video_info?: {
    duration_millis?: number;
    variants?: { content_type?: string; bitrate?: number; url?: string }[];
  };
}

export interface TweetPayload {
  __typename?: string;
  id_str?: string;
  text?: string;
  created_at?: string;
  favorite_count?: number;
  conversation_count?: number;
  user?: {
    name?: string;
    screen_name?: string;
    profile_image_url_https?: string;
  };
  mediaDetails?: TweetMedia[];
}

/** Sort the progressive MP4s from best to worst; HLS/DASH playlists dropped. */
export function selectMp4s(media: TweetMedia): { url: string; bitrate: number; width: number; height: number }[] {
  const variants = media.video_info?.variants || [];
  const out: { url: string; bitrate: number; width: number; height: number }[] = [];
  for (const variant of variants) {
    const url = typeof variant.url === 'string' ? variant.url : '';
    if (!url || variant.content_type !== 'video/mp4' || !/^https:\/\/[^/]*twimg\.com\//i.test(url)) continue;
    // /ext_tw_video/<id>/pu/vid/1280x720/<hash>.mp4
    const size = url.match(/\/(\d{2,5})x(\d{2,5})\/[^/]+$/);
    out.push({
      url,
      bitrate: Number(variant.bitrate) || 0,
      width: size ? Number(size[1]) : 0,
      height: size ? Number(size[2]) : 0,
    });
  }
  const seen = new Set<string>();
  return out
    .filter((entry) => (seen.has(entry.url) ? false : (seen.add(entry.url), true)))
    .sort((a, b) => b.bitrate - a.bitrate || b.width - a.width);
}

function durationLabel(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function isProxyableTwitterHost(hostname: string): boolean {
  const host = (hostname || '').toLowerCase();
  return host === 'twimg.com' || host.endsWith('.twimg.com');
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

function twitterErrorFor(status: number): TwitterError {
  if (status === 404) {
    return new TwitterError(
      'X says this post does not exist. It may have been deleted, or the link may be incomplete.',
      404
    );
  }
  if (status === 401 || status === 403) {
    return new TwitterError(
      'X refused this post without a signed-in session. Protected posts and posts restricted in this region cannot be read here.',
      403
    );
  }
  if (status === 429) {
    return new TwitterError(
      'X is rate-limiting this server right now. Wait a minute and press Get media again.',
      429
    );
  }
  return new TwitterError('X did not answer properly. Please try again in a minute.', 502);
}

/**
 * The endpoint answers with the embedded-tweet payload, the word "undefined"
 * for a post it cannot render, or an HTML error page. All three are handled.
 */
export function parseTweetPayload(text: string): TweetPayload | null {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed === 'undefined' || trimmed.startsWith('<')) return null;
  try {
    const parsed = JSON.parse(trimmed) as TweetPayload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a public X post URL into a download descriptor.
 * Throws TwitterError with a user-facing message on any failure.
 */
export async function extractTwitterPost(rawUrl: string): Promise<TwitterResult> {
  const ref = parseTwitterPostUrl(rawUrl);
  if (!ref) {
    throw new TwitterError(
      'Paste a public X post link, for example https://x.com/NASA/status/2051361508181856362',
      400
    );
  }

  const id = ref.id;
  const canonicalUrl = twitterPostUrl(id);
  const endpoint = `${TWITTER_CDN}/tweet-result?id=${id}&lang=en&token=${tweetToken(id)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let payload: TweetPayload | null;
  try {
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        // This endpoint is meant for third-party embeds; saying so is accurate.
        Referer: 'https://platform.twitter.com/',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw twitterErrorFor(response.status);
    payload = parseTweetPayload(await response.text());
  } catch (error) {
    if (error instanceof TwitterError) throw error;
    throw new TwitterError('X did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }

  if (!payload) {
    // A post X will not render to an embed: deleted, protected, age-restricted
    // or withheld. Say the reason class rather than inventing media.
    throw new TwitterError(
      'X will not show this post to a logged-out reader, so its media cannot be read here. Deleted, protected and restricted posts behave this way.',
      404
    );
  }
  if (payload.__typename === 'TweetTombstone') {
    throw new TwitterError(
      'This post is no longer available: it was deleted, or the author restricted who can see it.',
      404
    );
  }

  const mediaList = Array.isArray(payload.mediaDetails) ? payload.mediaDetails : [];
  if (mediaList.length === 0) {
    throw new TwitterError(
      'This post has no video or image of its own. Text-only posts and quote-post links carry no media — open the post that actually contains the video or photo and paste its link.',
      404
    );
  }

  const handle = (payload.user?.screen_name || 'x').replace(/[^a-zA-Z0-9_]/g, '') || 'x';
  const avatar = (payload.user?.profile_image_url_https || '').replace(/_normal\.(jpg|jpeg|png)$/i, '_400x400.$1');
  const fileBase = `igsavego_x_${id}_${handle.slice(0, 40)}`;

  let usedDirectLink = false;
  const proxied = (source: string, filename: string): string => {
    let host = '';
    try {
      host = new URL(source).hostname;
    } catch {
      host = '';
    }
    if (!isProxyableTwitterHost(host)) {
      usedDirectLink = true;
      return source;
    }
    return `/api/proxy-media?url=${encodeURIComponent(source)}&filename=${encodeURIComponent(filename)}`;
  };

  const items: TwitterAsset[] = [];
  const notes: string[] = [];
  let videoDuration = '';
  let renditionNote = '';

  let photoIndex = 0;
  for (const media of mediaList) {
    if (!media || typeof media.media_url_https !== 'string') continue;

    if (media.type === 'photo') {
      if (photoIndex >= MAX_PHOTOS) continue;
      photoIndex += 1;
      const original = `${media.media_url_https}?name=orig`;
      const probe = await probeMedia(original);
      const source = probe.ok ? original : media.media_url_https;
      const mime = probe.mime;
      const format: 'jpg' | 'png' | 'webp' = mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : 'jpg';
      const width = Number(media.original_info?.width) || Number(media.sizes?.large?.w) || 0;
      const height = Number(media.original_info?.height) || Number(media.sizes?.large?.h) || 0;
      const dimensions = width && height ? `${width}×${height}` : '';
      const sizeLabel = formatBytes(probe.bytes);
      const filename = `${fileBase}_photo_${photoIndex}.${format}`;
      const downloadUrl = proxied(source, filename);
      const thumbUrl = proxied(media.media_url_https, `${fileBase}_photo_${photoIndex}_thumb.jpg`);

      items.push({
        id: `item_${id}_photo_${photoIndex}`,
        type: 'photo',
        url: downloadUrl,
        downloadUrl,
        thumbnail: thumbUrl,
        quality: `Photo as published on X (${format.toUpperCase()})`,
        dimensions,
        fileSize: sizeLabel,
        format,
        availableQualities: [
          {
            id: 'original',
            label: `Photo as published on X (${format.toUpperCase()})`,
            quality: 'original',
            resolution: dimensions,
            fileSize: sizeLabel,
            downloadUrl,
            format,
            bitrate: 'Original upload, no re-encode',
          },
        ],
      });
      continue;
    }

    // video / animated_gif
    const candidates = selectMp4s(media).slice(0, 3);
    if (candidates.length === 0) continue;

    let videoUrl = '';
    let videoProbe: Probe = { bytes: null, mime: '', ok: false };
    let best = candidates[0];
    for (const candidate of candidates) {
      const probe = await probeMedia(candidate.url);
      if (probe.ok && probe.mime.startsWith('video/')) {
        videoUrl = candidate.url;
        videoProbe = probe;
        best = candidate;
        break;
      }
    }
    if (!videoUrl) continue;

    const dimensions = best.width && best.height ? `${best.width}×${best.height}` : '';
    const isGif = media.type === 'animated_gif';
    const duration = durationLabel(media.video_info?.duration_millis);
    if (duration && !videoDuration) videoDuration = duration;

    const label = `${isGif ? 'Animated GIF' : 'Video'} as published on X (MP4${
      dimensions ? ` · ${dimensions}` : ''
    })`;
    const filename = `${fileBase}_${isGif ? 'gif' : 'video'}${
      dimensions ? `_${best.width}x${best.height}` : ''
    }.mp4`;
    const downloadUrl = proxied(videoUrl, filename);
    const thumbUrl = proxied(media.media_url_https, `${fileBase}_${isGif ? 'gif' : 'video'}_poster.jpg`);
    const kbps = best.bitrate > 0 ? `${Math.round(best.bitrate / 1000)} kbps` : '';
    const sizeLabel = formatBytes(videoProbe.bytes);

    items.push({
      id: `item_${id}_${isGif ? 'gif' : 'video'}`,
      type: 'video',
      url: downloadUrl,
      downloadUrl,
      thumbnail: thumbUrl,
      quality: label,
      dimensions,
      fileSize: sizeLabel,
      format: 'mp4',
      availableQualities: [
        {
          id: 'original',
          label,
          quality: 'original',
          resolution: dimensions,
          fileSize: sizeLabel,
          downloadUrl,
          format: 'mp4',
          bitrate: kbps ? `${kbps}, file as published by X` : 'File as published by X',
        },
      ],
    });

    if (isGif) {
      notes.push('X stores animated GIFs as MP4 files, so this downloads as MP4 (no audio track).');
    }
    if (!isGif && candidates.length > 1) {
      const list = candidates
        .map((candidate) => (candidate.width && candidate.height ? `${candidate.width}×${candidate.height}` : 'MP4'))
        .join(', ');
      renditionNote = `X publishes this video as several MP4 renditions (${list}); the largest one that responded is offered here, with nothing re-encoded.`;
    }
  }

  if (items.length === 0) {
    throw new TwitterError(
      'X listed no downloadable file for this post. Its video may still be processing, or the media was removed — try again in a minute.',
      404
    );
  }
  if (renditionNote) notes.unshift(renditionNote);
  if (usedDirectLink) {
    notes.push('This file is served directly by the X CDN instead of being proxied through this site.');
  }

  const text = (payload.text || '').replace(/\s+https:\/\/t\.co\/\S+\s*$/i, '').trim();
  const mediaType: 'video' | 'photo' = items.some((item) => item.type === 'video') ? 'video' : 'photo';

  return {
    id,
    mediaType,
    originalUrl: canonicalUrl,
    author: {
      username: handle,
      fullName: (payload.user?.name || handle).substring(0, 120),
      avatar,
      // The public embed payload does not expose the verification flag, so the
      // card must not claim a badge it cannot back up.
      isVerified: false,
    },
    caption: text.substring(0, MAX_TEXT),
    timestamp: formatDate(payload.created_at),
    likes: formatCount(payload.favorite_count),
    comments: formatCount(payload.conversation_count),
    ...(videoDuration ? { duration: videoDuration } : {}),
    provider: 'x-public',
    ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    items,
  };
}
