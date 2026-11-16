// Kick public clip / VOD extractor shared by every host:
//   - functions/api/kick.ts        (Cloudflare Pages Functions)
//   - api/kick.ts                  (Vercel, inlined copy)
//   - server.ts                    (Express dev / Docker)
//   - functions/api/kick-clip.ts + api/kick-clip.ts (streams an assembled clip)
//
// What Kick actually exposes (verified live against public clips and VODs):
//   Clip  GET https://kick.com/api/v2/clips/<clip_id>
//         -> { clip: { id, title, duration, views_count, likes_count,
//              created_at, thumbnail_url, clip_url|video_url, category,
//              channel: { slug, username } } }
//         clip_url is an HLS playlist on clips.kick.com whose entries are
//         MPEG-TS segments addressed with #EXT-X-BYTERANGE inside a few .ts
//         files. There is NO progressive MP4 for clips (every guessed mp4 path
//         returns 403 from the bucket).
//   VOD   GET https://kick.com/api/v2/channels/<slug>/videos
//         -> [ { session_title, duration (ms), thumbnail{src,srcset}, source,
//               video: { uuid }, channel, viewer_count, ... } ]
//         `source` is the master.m3u8 with 1080p60/720p60/480p/360p/160p
//         variants. A VOD is hours long, so a single-file download would be
//         several GB and thousands of segments.
//
// What this module therefore promises, and what it refuses to invent:
//   1. A clip IS downloadable: the exact byterange segments are re-assembled
//      into one MPEG-TS file by /api/kick-clip (see buildClipStream below), so
//      the bytes are Kick's own — no re-encode, no screen recording.
//   2. A VOD is NOT turned into a fake MP4 button. The page shows the real
//      variant playlists and a ready yt-dlp command, and says plainly why.
//   3. Live channels are rejected: a live broadcast has no end.
//
// Dependency-free: only `fetch`, so the same code runs on Workers (no Node
// builtins) and on Node 24.

import { formatBytes, formatCount } from './mediaFormat';

export const KICK_ORIGIN = 'https://kick.com';
export const KICK_API = 'https://kick.com/api/v2';
/** Newer JSON API (channel info, VOD playback); v1 prefixes the web domain. */
export const KICK_WEB_API = 'https://web.kick.com/api/v1';

const MAX_INPUT = 2048;
const FETCH_TIMEOUT_MS = 15000;
const MAX_TEXT = 600;
const MAX_PLAYLIST_BYTES = 512 * 1024;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class KickError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'KickError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export type KickTarget =
  | { kind: 'clip'; clipId: string }
  | { kind: 'vod'; slug: string; videoId: string }
  | { kind: 'channel'; slug: string };

const UUID_PATTERN = /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
const CLIP_PATTERN = /clip_[A-Za-z0-9]{8,}/;
const RESERVED_SLUGS = new Set([
  'video',
  'videos',
  'categories',
  'search',
  'auth',
  'clips',
  'messages',
  'following',
  'browse',
  'dashboard',
  'about',
  'legal',
]);

/**
 * Accepts the link shapes Kick hands out:
 *   https://kick.com/<channel>?clip=clip_01H811MXG4FBR62FXPE1AXABDH
 *   https://kick.com/<channel>/clips/clip_01H811MXG4FBR62FXPE1AXABDH
 *   https://kick.com/clips/clip_01H811MXG4FBR62FXPE1AXABDH
 *   clip_01H811MXG4FBR62FXPE1AXABDH                        (bare clip id)
 *   https://kick.com/<channel>/videos/<uuid>               (VOD)
 *   https://kick.com/video/<uuid>                          (older VOD link)
 * Channel pages are reported separately so the UI can explain that a live
 * stream has no file, instead of pretending the link is broken.
 */
export function parseKickUrl(rawInput: string): KickTarget | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > MAX_INPUT) return null;

  if (/^clip_[A-Za-z0-9]{8,}$/.test(input)) return { kind: 'clip', clipId: input };
  if (UUID_PATTERN.test(input) && !/kick\.com/i.test(input)) {
    return { kind: 'vod', slug: '', videoId: input.match(UUID_PATTERN)![0].toLowerCase() };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  if (host !== 'kick.com' && !host.endsWith('.kick.com')) return null;

  const path = parsed.pathname;

  const clipParam = parsed.searchParams.get('clip');
  if (clipParam && CLIP_PATTERN.test(clipParam)) {
    return { kind: 'clip', clipId: clipParam.match(CLIP_PATTERN)![0] };
  }

  const clipPath = path.match(/^\/(?:[\w.-]+\/)?clips?\/(clip_[A-Za-z0-9]{8,})/i);
  if (clipPath) return { kind: 'clip', clipId: clipPath[1] };

  const vodPath = path.match(/^\/([\w.-]{2,40})\/videos\/([0-9a-f-]{36})/i);
  if (vodPath) return { kind: 'vod', slug: vodPath[1].toLowerCase(), videoId: vodPath[2].toLowerCase() };

  const shortVod = path.match(/^\/video\/([0-9a-f-]{36})/i);
  if (shortVod) return { kind: 'vod', slug: '', videoId: shortVod[1].toLowerCase() };

  const channel = path.match(/^\/([\w.-]{2,40})\/?$/);
  if (channel && !RESERVED_SLUGS.has(channel[1].toLowerCase())) {
    return { kind: 'channel', slug: channel[1].toLowerCase() };
  }

  return null;
}

export function kickClipPageUrl(clipId: string, slug: string): string {
  return slug ? `${KICK_ORIGIN}/${slug}?clip=${clipId}` : `${KICK_ORIGIN}/clips/${clipId}`;
}

/** Hosts the /api/proxy-media allowlist accepts for Kick results. */
export function isProxyableKickHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'clips.kick.com' ||
    host === 'images.kick.com' ||
    host === 'kick.com' ||
    host.endsWith('.kick.com')
  );
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * kick.com sits behind bot protection that answers `Request blocked by security
 * policy` to the TLS fingerprint of Node's global fetch (undici), while the
 * same request from Node's `https` module, curl or a Python client returns 200.
 * The host below is therefore pluggable: the Express server and the Vercel
 * function inject a `node:https` transport, while Workers/Pages use the native
 * fetch default. Media CDNs (clips/images/stream.kick.com) accept plain fetch.
 */
export interface KickTextResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}

export type KickTransport = (
  url: string,
  init?: { headers?: Record<string, string>; method?: string; body?: string }
) => Promise<KickTextResponse>;

const webTransport: KickTransport = (url, init) =>
  fetch(url, {
    method: init?.method,
    body: init?.body,
    headers: init?.headers,
  }) as unknown as Promise<KickTextResponse>;

let transport: KickTransport = webTransport;

/** Install a host-specific transport (Node `https`) for kick.com API calls. */
export function configureKickTransport(next: KickTransport): void {
  transport = next;
}

/** Restore the default fetch transport (used by tests and by Pages). */
export function resetKickTransport(): void {
  transport = webTransport;
}

async function kickFetchJson<T>(url: string, notFoundMessage: string): Promise<T> {
  try {
    const response = await transport(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        Referer: `${KICK_ORIGIN}/`,
      },
    });
    if (response.status === 404 || response.status === 410) throw new KickError(notFoundMessage, 404);
    if (response.status === 403 || response.status === 429) {
      throw new KickError(
        'Kick refused the request from this server (HTTP ' +
          response.status +
          '). That is Kick rate-limiting automated access — please try again in a few minutes.',
        503
      );
    }
    if (!response.ok) throw new KickError(`Kick returned HTTP ${response.status}. Please try again.`, 502);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof KickError) throw error;
    throw new KickError('Kick did not respond in time. Please try again in a minute.', 502);
  }
}

async function kickFetchText(url: string): Promise<string> {
  try {
    const response = await transport(url, {
      headers: { Accept: '*/*', 'User-Agent': USER_AGENT, Referer: `${KICK_ORIGIN}/` },
    });
    if (!response.ok) throw new KickError(`Kick returned HTTP ${response.status} for this stream.`, 502);
    const body = await response.text();
    if (body.length > MAX_PLAYLIST_BYTES) throw new KickError('Kick returned an unexpected playlist.', 502);
    return body;
  } catch (error) {
    if (error instanceof KickError) throw error;
    throw new KickError('Could not read that Kick stream. Please try again.', 502);
  }
}

// ---------------------------------------------------------------------------
// HLS playlists
// ---------------------------------------------------------------------------

export interface ClipSegment {
  url: string;
  /** Byte offset inside `url` (`#EXT-X-BYTERANGE`), or null for a whole file. */
  start: number | null;
  /** Byte length of this segment, or null for a whole file. */
  length: number | null;
}

export interface ClipPlaylist {
  segments: ClipSegment[];
  durationSec: number;
  bytes: number;
}

/**
 * Read a media playlist into the exact byte ranges it lists. Kick stores a
 * clip as a handful of `.ts` files and points at slices inside them, so the
 * offsets matter: concatenating whole files would splice in neighbouring
 * clips.
 */
export function parseClipPlaylist(text: string, baseUrl: string): ClipPlaylist {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const segments: ClipSegment[] = [];
  let durationSec = 0;
  let bytes = 0;
  let pending: { start: number; length: number } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      durationSec += Number.parseFloat(line.slice('#EXTINF:'.length)) || 0;
      continue;
    }
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      const [lengthPart, offsetPart] = line.slice('#EXT-X-BYTERANGE:'.length).split('@');
      const length = Number.parseInt(lengthPart, 10);
      const offset = Number.parseInt(offsetPart || '0', 10);
      if (Number.isFinite(length) && length > 0) {
        pending = { start: Number.isFinite(offset) ? offset : 0, length };
      }
      continue;
    }
    if (line.startsWith('#')) continue;

    let url: string;
    try {
      url = new URL(line, baseUrl).toString();
    } catch {
      continue;
    }
    segments.push(pending ? { url, start: pending.start, length: pending.length } : { url, start: null, length: null });
    if (pending) bytes += pending.length;
    pending = null;
  }

  return { segments, durationSec, bytes };
}

/**
 * Stream the segments in playlist order. Each segment is requested with its
 * Range header so only the clip's own bytes are sent. A failed segment is
 * skipped rather than aborting the whole download, and the caller reports the
 * real byte count it measured from the playlist.
 */
export function buildClipStream(segments: ClipSegment[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const segment of segments) {
        try {
          const headers: Record<string, string> = {
            'User-Agent': USER_AGENT,
            Accept: '*/*',
            Referer: `${KICK_ORIGIN}/`,
          };
          if (segment.start !== null && segment.length !== null) {
            headers.Range = `bytes=${segment.start}-${segment.start + segment.length - 1}`;
          }
          const response = await fetch(segment.url, { headers });
          if (!response.ok || !response.body) continue;
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
        } catch {
          // One missing segment leaves a small gap; the rest still downloads.
        }
      }
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Clip extraction
// ---------------------------------------------------------------------------

interface KickClipApi {
  clip?: {
    id?: string;
    title?: string;
    duration?: number;
    views_count?: number;
    view_count?: number;
    likes_count?: number;
    likes?: number;
    created_at?: string;
    thumbnail_url?: string;
    clip_url?: string;
    video_url?: string;
    playback_url?: string;
    category?: { name?: string };
    channel?: { slug?: string; username?: string; profile_pic?: string };
  };
  message?: string;
}

export interface KickClipResult {
  kind: 'clip';
  id: string;
  title: string;
  channel: string;
  category: string;
  createdAt: string;
  duration: string;
  views: string;
  likes: string;
  /** Measured from the playlist: the exact number of bytes assembled. */
  fileSize: string;
  /** /api/kick-clip?id=… — the assembled MPEG-TS file. */
  downloadUrl: string;
  /** File name the download endpoint sends. */
  filename: string;
  pageUrl: string;
  thumbnailUrl: string;
  thumbnailDownload: string;
  note: string;
}

function clockLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function proxied(source: string, filename: string): string {
  let host = '';
  try {
    host = new URL(source).hostname;
  } catch {
    host = '';
  }
  if (!isProxyableKickHost(host)) return source;
  return `/api/proxy-media?url=${encodeURIComponent(source)}&filename=${encodeURIComponent(filename)}`;
}

async function extractKickClip(clipId: string): Promise<KickClipResult> {
  const payload = await kickFetchJson<KickClipApi>(
    `${KICK_API}/clips/${encodeURIComponent(clipId)}`,
    'Kick did not return this clip. It may be deleted, private, or limited to signed-in members.'
  );
  const clip = payload.clip;
  if (!clip) {
    throw new KickError('Kick did not return this clip. It may be deleted or private.', 404);
  }

  const playlistUrl = clip.clip_url || clip.video_url || clip.playback_url || '';
  if (!/^https?:\/\//i.test(playlistUrl)) {
    throw new KickError('Kick did not publish a playable stream for this clip.', 404);
  }

  const playlistText = await kickFetchText(playlistUrl);
  const playlist = parseClipPlaylist(playlistText, playlistUrl);
  if (playlist.segments.length === 0) {
    throw new KickError('Kick listed no video segments for this clip. Please try again later.', 502);
  }

  const slug = clip.channel?.slug || '';
  const author = clip.channel?.username || slug || 'kick';
  const title = (clip.title || '').trim().substring(0, MAX_TEXT) || `Kick clip ${clipId}`;
  const durationSec = playlist.durationSec || clip.duration || 0;
  const fileBase = `igsavego_kick_${clipId}_${author.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40)}`;
  const thumbnail = clip.thumbnail_url || '';

  return {
    kind: 'clip',
    id: clipId,
    title,
    channel: author,
    category: clip.category?.name || '',
    createdAt: clip.created_at || '',
    duration: durationSec > 0 ? clockLabel(durationSec) : '',
    // A zero is not a number worth showing: the panel hides empty fields.
    views:
      (clip.views_count ?? clip.view_count ?? 0) > 0
        ? formatCount(clip.views_count ?? clip.view_count ?? null)
        : '',
    likes: (clip.likes_count ?? clip.likes ?? 0) > 0 ? formatCount(clip.likes_count ?? clip.likes ?? null) : '',
    fileSize: playlist.bytes > 0 ? formatBytes(playlist.bytes) : '',
    downloadUrl: `/api/kick-clip?id=${encodeURIComponent(clipId)}`,
    filename: `${fileBase}.ts`,
    pageUrl: kickClipPageUrl(clipId, slug),
    thumbnailUrl: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.png`) : '',
    thumbnailDownload: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.png`) : '',
    note:
      'Kick publishes clips only as an HLS stream, so the download is the clip’s own MPEG-TS segments joined in order — no re-encode and no watermark. VLC, MPV, PotPlayer and ffmpeg open it directly; browser tabs and some phone galleries do not.',
  };
}

// ---------------------------------------------------------------------------
// VOD extraction
// ---------------------------------------------------------------------------

export interface KickVodVariant {
  id: string;
  label: string;
  resolution: string;
  bitrate: string;
  url: string;
}

export interface KickVodResult {
  kind: 'vod';
  id: string;
  title: string;
  channel: { slug: string; name: string };
  category: string;
  duration: string;
  startedAt: string;
  views: string;
  pageUrl: string;
  thumbnail: string;
  thumbnailDownload: string;
  variants: KickVodVariant[];
  /** Ready-to-paste command: a browser cannot join thousands of HLS segments. */
  ytdlp: string;
  note: string;
}

function parseMasterPlaylist(text: string, baseUrl: string): KickVodVariant[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const variants: KickVodVariant[] = [];
  let pending: { resolution: string; bandwidth: number } | null = null;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const resolution = line.match(/RESOLUTION=(\d+x\d+)/i)?.[1] || '';
      const bandwidth = Number.parseInt(line.match(/BANDWIDTH=(\d+)/i)?.[1] || '0', 10);
      pending = { resolution, bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0 };
      continue;
    }
    if (!pending || !line || line.startsWith('#')) continue;

    let url: string;
    try {
      url = new URL(line, baseUrl).toString();
    } catch {
      pending = null;
      continue;
    }
    const height = Number.parseInt(pending.resolution.split('x')[1] || '0', 10);
    variants.push({
      id: `v${height || variants.length}`,
      label: height ? `${height}p` : 'Playlist',
      resolution: pending.resolution,
      bitrate: pending.bandwidth ? `${Math.round(pending.bandwidth / 1000)} kbps` : '',
      url,
    });
    pending = null;
  }

  return variants.sort((a, b) => Number.parseInt(b.resolution.split('x')[1] || '0', 10) - Number.parseInt(a.resolution.split('x')[1] || '0', 10));
}

interface KickVodApiEntry {
  session_title?: string;
  duration?: number;
  created_at?: string;
  start_time?: string;
  viewer_count?: number;
  views?: number;
  source?: string;
  slug?: string;
  thumbnail?: { src?: string; srcset?: string } | string;
  categories?: { name?: string }[];
  category?: { name?: string };
  channel?: { slug?: string; username?: string };
  video?: { uuid?: string };
}

/**
 * The playback payload yt-dlp's kick:vod extractor reads.
 *
 * POST https://web.kick.com/api/v1/stream/<uuid>/playback
 *   -> { playback_url: { vod, thumbnail },
 *        video_session: { creator_id, video_title, video_duration,
 *                         video_series, video_content_type },
 *        data: { type, details } | null }
 *
 * This answers for every VOD Kick still stores, including ones missing from
 * GET /api/v2/channels/<slug>/videos — that listing only holds a page of the
 * channel's newest VODs, so a perfectly playable older VOD is absent from it.
 * Searching that list was therefore reporting live VODs as expired.
 */
interface KickPlayback {
  playback_url?: { vod?: string; thumbnail?: string };
  video_session?: {
    creator_id?: string;
    video_id?: string;
    video_title?: string;
    video_duration?: number;
    video_series?: string;
    video_content_type?: string;
    video_stream_status?: string;
  };
  data?: { type?: string; details?: string } | null;
}

const PLAYBACK_BODY = JSON.stringify({
  video_player: { player: {} },
  video_session: {},
  user_session: { non_personalised_ads: true },
});

async function resolveVodSlug(videoId: string): Promise<string> {
  try {
    // The transport follows redirects, so the final URL comes back as `url`.
    const response = await transport(`${KICK_ORIGIN}/video/${encodeURIComponent(videoId)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    const finalUrl = (response as { url?: string }).url || '';
    const match = new URL(finalUrl || KICK_ORIGIN).pathname.match(/^\/([\w.-]{2,40})\/videos\//i);
    return match ? match[1].toLowerCase() : '';
  } catch {
    // A bare VOD id is still downloadable; only the page link is less pretty.
    return '';
  }
}

async function fetchVodPlayback(videoId: string): Promise<KickPlayback | null> {
  try {
    const response = await transport(`${KICK_WEB_API}/stream/${encodeURIComponent(videoId)}/playback`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        Origin: KICK_ORIGIN,
        Referer: `${KICK_ORIGIN}/`,
      },
      body: PLAYBACK_BODY,
    });
    if (!response.ok) return null;
    return (await response.json()) as KickPlayback;
  } catch {
    // Blocked, offline or malformed: the channel listing below is the fallback.
    return null;
  }
}

/** Extra metadata from the channel's VOD page; absent for older VODs. */
async function findChannelVod(channelSlug: string, videoId: string): Promise<KickVodApiEntry | null> {
  if (!channelSlug) return null;
  try {
    const list = await kickFetchJson<KickVodApiEntry[] | { data?: KickVodApiEntry[] }>(
      `${KICK_API}/channels/${encodeURIComponent(channelSlug)}/videos`,
      'Kick did not return this channel’s VODs. The link may be wrong, or the channel was removed.'
    );
    const entries = Array.isArray(list) ? list : list.data || [];
    return entries.find((item) => (item.video?.uuid || '').toLowerCase() === videoId) || null;
  } catch {
    return null;
  }
}

function pickThumbnail(entry: KickVodApiEntry | null, playback: KickPlayback | null): string {
  const raw = typeof entry?.thumbnail === 'string' ? entry.thumbnail : entry?.thumbnail?.src || '';
  const srcset = entry && typeof entry.thumbnail === 'object' ? entry.thumbnail.srcset || '' : '';
  // The srcset lists the large renditions: take the widest one.
  const bestFromSrcset = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .filter((part) => part[0] && /\.(?:webp|jpe?g|png)$/i.test(part[0]))
    .sort((a, b) => Number.parseInt((b[1] || '0').replace(/\D/g, ''), 10) - Number.parseInt((a[1] || '0').replace(/\D/g, ''), 10))[0]?.[0];
  // Playback ships only a sprite sheet of preview frames ({index} per frame).
  const sheet = (playback?.playback_url?.thumbnail || '').replace('{index}', '0');
  return bestFromSrcset || raw || sheet;
}

function vodPageUrl(channelSlug: string, videoId: string): string {
  return channelSlug
    ? `${KICK_ORIGIN}/${channelSlug}/videos/${videoId}`
    : `${KICK_ORIGIN}/video/${videoId}`;
}

async function extractKickVod(slug: string, videoId: string): Promise<KickVodResult> {
  const [playback, resolvedSlug] = await Promise.all([
    fetchVodPlayback(videoId),
    slug ? Promise.resolve(slug) : resolveVodSlug(videoId),
  ]);
  const channelSlug = slug || resolvedSlug;
  const entry = await findChannelVod(channelSlug, videoId);
  const session = playback?.video_session;

  const masterUrl = playback?.playback_url?.vod || entry?.source || '';
  if (!/^https?:\/\//i.test(masterUrl)) {
    const pageUrl = vodPageUrl(channelSlug, videoId);
    const detail = playback?.data?.details || playback?.data?.type || '';
    throw new KickError(
      'Kick returned no playback for this VOD, so it is expired, removed, or reserved for channel subscribers' +
        (detail ? ` (Kick said: ${detail})` : '') +
        '. Nothing on this page can turn it into a file. Download it on your own machine instead:\n\n' +
        `yt-dlp -f "bv*+ba/b" "${pageUrl}"` +
        '\n\nAdd --cookies-from-browser chrome (or edge/firefox) when Kick asks for a subscription.',
      404
    );
  }

  const masterText = await kickFetchText(masterUrl);
  const variants = parseMasterPlaylist(masterText, masterUrl);
  if (variants.length === 0) {
    throw new KickError('Kick published no downloadable quality for this VOD.', 502);
  }

  // The channel listing reports milliseconds; playback reports seconds.
  const durationMs = entry?.duration || 0;
  const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : session?.video_duration || 0;
  const duration =
    durationSec > 0
      ? `${Math.floor(durationSec / 3600)}:${String(Math.floor((durationSec % 3600) / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`
      : '';

  const thumbnail = pickThumbnail(entry, playback);
  const author = entry?.channel?.username || session?.video_series || channelSlug || 'kick';
  const title = (entry?.session_title || session?.video_title || '').trim().substring(0, MAX_TEXT) || `Kick VOD ${videoId}`;
  const pageUrl = vodPageUrl(channelSlug, videoId);
  const fileBase = `igsavego_kick_vod_${videoId.slice(0, 8)}_${author.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30)}`;

  return {
    kind: 'vod',
    id: videoId,
    title,
    channel: { slug: channelSlug, name: author },
    category: entry?.category?.name || entry?.categories?.[0]?.name || session?.video_content_type || '',
    duration,
    startedAt: entry?.start_time || entry?.created_at || '',
    views: formatCount(entry?.viewer_count ?? entry?.views ?? null),
    pageUrl,
    thumbnail: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.webp`) : '',
    thumbnailDownload: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.webp`) : '',
    variants,
    ytdlp: `yt-dlp -f "bv*+ba/b" "${pageUrl}"`,
    note:
      'A Kick VOD is one HLS stream of several gigabytes split into thousands of short segments, so no browser or edge function can hand it over as one MP4 without re-encoding. These are the exact quality playlists Kick serves for this VOD; open one in VLC/MPV, or run the yt-dlp command to save a single file. The VOD thumbnail is downloadable here.',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractKick(rawUrl: string): Promise<KickClipResult | KickVodResult> {
  const target = parseKickUrl(rawUrl);
  if (!target) {
    throw new KickError(
      'Paste a public Kick clip or VOD link, for example https://kick.com/xqc?clip=clip_01H811MXG4FBR62FXPE1AXABDH or https://kick.com/xqc/videos/371f0495-9aaa-4e7a-b88e-22b50c6194b0',
      400
    );
  }

  if (target.kind === 'channel') {
    throw new KickError(
      'That is a live channel link, and a live broadcast has no end — there is no single file to save. Use a clip link (?clip=...) or a VOD link (/<channel>/videos/<id>) instead.',
      400
    );
  }

  return target.kind === 'clip'
    ? extractKickClip(target.clipId)
    : extractKickVod(target.slug, target.videoId);
}

/** Playlist used by /api/kick-clip; exported so the stream route stays thin. */
export async function loadClipPlaylist(clipId: string): Promise<{ playlist: ClipPlaylist; filename: string }> {
  const payload = await kickFetchJson<KickClipApi>(
    `${KICK_API}/clips/${encodeURIComponent(clipId)}`,
    'Kick did not return this clip. It may be deleted, private, or limited to signed-in members.'
  );
  const clip = payload.clip;
  const playlistUrl = clip?.clip_url || clip?.video_url || clip?.playback_url || '';
  if (!clip || !/^https?:\/\//i.test(playlistUrl)) {
    throw new KickError('Kick did not publish a playable stream for this clip.', 404);
  }
  const playlist = parseClipPlaylist(await kickFetchText(playlistUrl), playlistUrl);
  if (playlist.segments.length === 0) {
    throw new KickError('Kick listed no video segments for this clip.', 502);
  }
  const author = (clip.channel?.username || clip.channel?.slug || 'kick').replace(/[^a-zA-Z0-9._-]/g, '_');
  return { playlist, filename: `igsavego_kick_${clipId}_${author.slice(0, 40)}.ts` };
}
