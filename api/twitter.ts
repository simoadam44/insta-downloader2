import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the X
// logic is inlined here. Keep it in sync with lib/twitterExtract.ts, which is
// the source used by Cloudflare Pages Functions and server.ts.)
//
// X removed anonymous API access, but the endpoint behind its own embedded-tweet
// widget is still public and token-only:
//   https://cdn.syndication.twimg.com/tweet-result?id=<id>&lang=en&token=<t>
// where <t> is derived from the post id exactly as X's embed script does it.
// The payload carries the post's text, author, and mediaDetails with the photo
// file or the video's progressive MP4 renditions. No cookie or key is used.

const TWITTER_CDN = 'https://cdn.syndication.twimg.com';
const MAX_INPUT = 2048;
const FETCH_TIMEOUT_MS = 12000;
const PROBE_TIMEOUT_MS = 6000;
const MAX_TEXT = 600;
const MAX_PHOTOS = 4;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Formatting (kept identical to lib/mediaFormat.ts)
// ---------------------------------------------------------------------------

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1);
  return `${rounded} ${units[unit]}`;
}

function formatCount(value: unknown): string {
  const n = asNumber(value);
  if (n === null) return '';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatDate(iso: unknown): string {
  const value = typeof iso === 'string' ? iso.trim().substring(0, 40) : '';
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

const STATUS_PATH = /\/status(?:es)?\/(\d{15,25})(?:[/?#]|$)/i;
const ID_ONLY = /^\d{15,25}$/;

function parseTwitterPostUrl(rawInput: string): { id: string } | null {
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
  const isTwitterHost =
    host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com');
  if (!isTwitterHost) return null;

  const match = parsed.pathname.match(STATUS_PATH);
  return match ? { id: match[1] } : null;
}

function tweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  media_url_https: string;
  original_info?: { width?: number; height?: number };
  sizes?: Record<string, { w?: number; h?: number }>;
  video_info?: {
    duration_millis?: number;
    variants?: { content_type?: string; bitrate?: number; url?: string }[];
  };
}

interface TweetPayload {
  __typename?: string;
  text?: string;
  created_at?: string;
  favorite_count?: number;
  conversation_count?: number;
  user?: { name?: string; screen_name?: string; profile_image_url_https?: string };
  mediaDetails?: TweetMedia[];
}

function selectMp4s(media: TweetMedia): { url: string; bitrate: number; width: number; height: number }[] {
  const variants = media.video_info?.variants || [];
  const out: { url: string; bitrate: number; width: number; height: number }[] = [];
  for (const variant of variants) {
    const url = typeof variant.url === 'string' ? variant.url : '';
    if (!url || variant.content_type !== 'video/mp4' || !/^https:\/\/[^/]*twimg\.com\//i.test(url)) continue;
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

function isProxyableTwitterHost(hostname: string): boolean {
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
    return { bytes: Number.isFinite(length) && length > 0 ? length : null, mime, ok: response.ok };
  } catch {
    return { bytes: null, mime: '', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function twitterErrorFor(status: number): HttpError {
  if (status === 404) {
    return new HttpError(
      'X says this post does not exist. It may have been deleted, or the link may be incomplete.',
      404
    );
  }
  if (status === 401 || status === 403) {
    return new HttpError(
      'X refused this post without a signed-in session. Protected posts and posts restricted in this region cannot be read here.',
      403
    );
  }
  if (status === 429) {
    return new HttpError(
      'X is rate-limiting this server right now. Wait a minute and press Get media again.',
      429
    );
  }
  return new HttpError('X did not answer properly. Please try again in a minute.', 502);
}

function parseTweetPayload(text: string): TweetPayload | null {
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
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const raw = (req.method === 'GET' ? req.query.url : req.body?.url) || '';
  const rawUrl = (Array.isArray(raw) ? raw[0] : raw).toString().trim();

  if (!rawUrl) {
    return res.status(400).json({
      error: 'Paste a public X post link, for example https://x.com/NASA/status/2051361508181856362',
    });
  }
  if (rawUrl.length > MAX_INPUT) return res.status(414).json({ error: 'URL is too long.' });

  try {
    const id = parseTwitterPostUrl(rawUrl)?.id;
    if (!id) throw new HttpError('Paste a public X post link, for example https://x.com/NASA/status/2051361508181856362', 400);

    const canonicalUrl = `https://x.com/i/status/${id}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let payload: TweetPayload | null;
    try {
      const response = await fetch(
        `${TWITTER_CDN}/tweet-result?id=${id}&lang=en&token=${tweetToken(id)}`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
            Referer: 'https://platform.twitter.com/',
          },
          signal: controller.signal,
        }
      );
      if (!response.ok) throw twitterErrorFor(response.status);
      payload = parseTweetPayload(await response.text());
    } finally {
      clearTimeout(timer);
    }

    if (!payload) {
      throw new HttpError(
        'X will not show this post to a logged-out reader, so its media cannot be read here. Deleted, protected and restricted posts behave this way.',
        404
      );
    }
    if (payload.__typename === 'TweetTombstone') {
      throw new HttpError(
        'This post is no longer available: it was deleted, or the author restricted who can see it.',
        404
      );
    }

    const mediaList = Array.isArray(payload.mediaDetails) ? payload.mediaDetails : [];
    if (mediaList.length === 0) {
      throw new HttpError(
        'This post has no video or image of its own. Text-only posts and quote-post links carry no media — open the post that actually contains the video or photo and paste its link.',
        404
      );
    }

    const handle = (payload.user?.screen_name || 'x').replace(/[^a-zA-Z0-9_]/g, '') || 'x';
    const avatar = (payload.user?.profile_image_url_https || '').replace(
      /_normal\.(jpg|jpeg|png)$/i,
      '_400x400.$1'
    );
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

    const items: any[] = [];
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
        const downloadUrl = proxied(source, `${fileBase}_photo_${photoIndex}.${format}`);
        const thumbUrl = proxied(
          media.media_url_https,
          `${fileBase}_photo_${photoIndex}_thumb.jpg`
        );
        const label = `Photo as published on X (${format.toUpperCase()})`;

        items.push({
          id: `item_${id}_photo_${photoIndex}`,
          type: 'photo',
          url: downloadUrl,
          downloadUrl,
          thumbnail: thumbUrl,
          quality: label,
          dimensions,
          fileSize: sizeLabel,
          format,
          availableQualities: [
            {
              id: 'original',
              label,
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
      const thumbUrl = proxied(
        media.media_url_https,
        `${fileBase}_${isGif ? 'gif' : 'video'}_poster.jpg`
      );
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
          .map((candidate) =>
            candidate.width && candidate.height ? `${candidate.width}×${candidate.height}` : 'MP4'
          )
          .join(', ');
        renditionNote = `X publishes this video as several MP4 renditions (${list}); the largest one that responded is offered here, with nothing re-encoded.`;
      }
    }

    if (items.length === 0) {
      throw new HttpError(
        'X listed no downloadable file for this post. Its video may still be processing, or the media was removed — try again in a minute.',
        404
      );
    }
    if (renditionNote) notes.unshift(renditionNote);
    if (usedDirectLink) {
      notes.push('This file is served directly by the X CDN instead of being proxied through this site.');
    }

    const text = (payload.text || '').replace(/\s+https:\/\/t\.co\/\S+\s*$/i, '').trim();
    const mediaType = items.some((item) => item.type === 'video') ? 'video' : 'photo';

    return res.status(200).json({
      id,
      mediaType,
      originalUrl: canonicalUrl,
      author: {
        username: handle,
        fullName: (payload.user?.name || handle).substring(0, 120),
        avatar,
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
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(502).json({ error: 'Could not read that X post. Please try again in a minute.' });
  }
}
