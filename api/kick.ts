import type { VercelRequest, VercelResponse } from '@vercel/node';
import http from 'node:http';
import https from 'node:https';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the Kick
// logic is inlined here. Keep it in sync with lib/kickExtract.ts, which is the
// source used by Cloudflare Pages Functions and server.ts.)

const KICK_ORIGIN = 'https://kick.com';
const KICK_API = 'https://kick.com/api/v2';
const KICK_WEB_API = 'https://web.kick.com/api/v1';
const MAX_INPUT = 2048;
const FETCH_TIMEOUT_MS = 15000;
const MAX_TEXT = 600;
const MAX_PLAYLIST_BYTES = 512 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

interface KickTextResponse {
  ok: boolean;
  status: number;
  url: string;
  text(): Promise<string>;
  json(): Promise<any>;
}

// kick.com rejects Node's global fetch (undici) TLS fingerprint with
// `Request blocked by security policy`; node:https returns 200 for the same
// request, so this function uses it (redirects followed manually).
function nodeRequest(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  method = 'GET',
  body?: string,
  hops = 0
): Promise<KickTextResponse> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http:') ? http : https;
    const req = client.request(url, { method, headers }, (response) => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location && hops < 4) {
        response.resume();
        resolve(nodeRequest(new URL(location, url).toString(), headers, timeoutMs, method, body, hops + 1));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk as Buffer));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: status >= 200 && status < 300,
          status,
          url,
          text: async () => text,
          json: async () => JSON.parse(text),
        });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Kick request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** GET convenience wrapper used by the clip and playlist reads. */
function nodeGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  hops = 0
): Promise<KickTextResponse> {
  return nodeRequest(url, headers, timeoutMs, 'GET', undefined, hops);
}

class KickError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'KickError';
    this.status = status;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatCount(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

// ---------- URL parsing ----------
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

type KickTarget =
  | { kind: 'clip'; clipId: string }
  | { kind: 'vod'; slug: string; videoId: string }
  | { kind: 'channel'; slug: string };

function parseKickUrl(rawInput: string): KickTarget | null {
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

function isProxyableKickHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'clips.kick.com' || host === 'images.kick.com' || host === 'kick.com' || host.endsWith('.kick.com');
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

async function kickFetchJson<T>(url: string, notFoundMessage: string): Promise<T> {
  try {
    const response = await nodeGet(
      url,
      {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        Referer: `${KICK_ORIGIN}/`,
      },
      FETCH_TIMEOUT_MS
    );
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
    const response = await nodeGet(
      url,
      { Accept: '*/*', 'User-Agent': USER_AGENT, Referer: `${KICK_ORIGIN}/` },
      FETCH_TIMEOUT_MS
    );
    if (!response.ok) throw new KickError(`Kick returned HTTP ${response.status} for this stream.`, 502);
    const body = await response.text();
    if (body.length > MAX_PLAYLIST_BYTES) throw new KickError('Kick returned an unexpected playlist.', 502);
    return body;
  } catch (error) {
    if (error instanceof KickError) throw error;
    throw new KickError('Could not read that Kick stream. Please try again.', 502);
  }
}

// ---------- playlists ----------
interface ClipSegment {
  url: string;
  start: number | null;
  length: number | null;
}

function parseClipPlaylist(text: string, baseUrl: string): { segments: ClipSegment[]; durationSec: number; bytes: number } {
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

function parseMasterPlaylist(text: string, baseUrl: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const variants: { id: string; label: string; resolution: string; bitrate: string; url: string }[] = [];
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

  return variants.sort(
    (a, b) =>
      Number.parseInt(b.resolution.split('x')[1] || '0', 10) - Number.parseInt(a.resolution.split('x')[1] || '0', 10)
  );
}

function clockLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------- clip ----------
async function extractClip(clipId: string) {
  const payload = await kickFetchJson<any>(
    `${KICK_API}/clips/${encodeURIComponent(clipId)}`,
    'Kick did not return this clip. It may be deleted, private, or limited to signed-in members.'
  );
  const clip = payload?.clip;
  if (!clip) throw new KickError('Kick did not return this clip. It may be deleted or private.', 404);

  const playlistUrl = clip.clip_url || clip.video_url || clip.playback_url || '';
  if (!/^https?:\/\//i.test(playlistUrl)) throw new KickError('Kick did not publish a playable stream for this clip.', 404);

  const playlist = parseClipPlaylist(await kickFetchText(playlistUrl), playlistUrl);
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
    kind: 'clip' as const,
    id: clipId,
    title,
    channel: author,
    category: clip.category?.name || '',
    createdAt: clip.created_at || '',
    duration: durationSec > 0 ? clockLabel(durationSec) : '',
    views: formatCount(clip.views_count ?? clip.view_count ?? null),
    likes: formatCount(clip.likes_count ?? clip.likes ?? null),
    fileSize: playlist.bytes > 0 ? formatBytes(playlist.bytes) : '',
    downloadUrl: `/api/kick-clip?id=${encodeURIComponent(clipId)}`,
    filename: `${fileBase}.ts`,
    pageUrl: slug ? `${KICK_ORIGIN}/${slug}?clip=${clipId}` : `${KICK_ORIGIN}/clips/${clipId}`,
    thumbnailUrl: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.png`) : '',
    thumbnailDownload: thumbnail ? proxied(thumbnail, `${fileBase}_thumbnail.png`) : '',
    note: 'Kick publishes clips only as an HLS stream, so the download is the clip’s own MPEG-TS segments joined in order — no re-encode and no watermark. VLC, MPV, PotPlayer and ffmpeg open it directly; browser tabs and some phone galleries do not.',
  };
}

// ---------- vod ----------
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

// yt-dlp's kick:vod extractor resolves a VOD through this endpoint rather than
// through the channel listing, which only holds the newest page of VODs.
async function fetchVodPlayback(videoId: string): Promise<KickPlayback | null> {
  try {
    const response = await nodeRequest(
      `${KICK_WEB_API}/stream/${encodeURIComponent(videoId)}/playback`,
      {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        Origin: KICK_ORIGIN,
        Referer: `${KICK_ORIGIN}/`,
      },
      FETCH_TIMEOUT_MS,
      'POST',
      PLAYBACK_BODY
    );
    if (!response.ok) return null;
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

async function resolveVodSlug(videoId: string): Promise<string> {
  try {
    const response = await nodeGet(
      `${KICK_ORIGIN}/video/${encodeURIComponent(videoId)}`,
      { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      FETCH_TIMEOUT_MS
    );
    const match = new URL(response.url).pathname.match(/^\/([\w.-]{2,40})\/videos\//i);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

function pickThumbnail(entry: any, playback: KickPlayback | null): string {
  const raw = typeof entry?.thumbnail === 'string' ? entry.thumbnail : entry?.thumbnail?.src || '';
  const srcset = entry && typeof entry.thumbnail === 'object' ? entry.thumbnail.srcset || '' : '';
  const bestFromSrcset = srcset
    .split(',')
    .map((part: string) => part.trim().split(/\s+/))
    .filter((part: string[]) => part[0] && /\.(?:webp|jpe?g|png)$/i.test(part[0]))
    .sort(
      (a: string[], b: string[]) =>
        Number.parseInt((b[1] || '0').replace(/\D/g, ''), 10) - Number.parseInt((a[1] || '0').replace(/\D/g, ''), 10)
    )[0]?.[0];
  const sheet = (playback?.playback_url?.thumbnail || '').replace('{index}', '0');
  return bestFromSrcset || raw || sheet;
}

async function extractVod(slug: string, videoId: string) {
  const [playback, resolvedSlug] = await Promise.all([
    fetchVodPlayback(videoId),
    slug ? Promise.resolve(slug) : resolveVodSlug(videoId),
  ]);
  const channelSlug = slug || resolvedSlug;

  let entry: any = null;
  if (channelSlug) {
    try {
      const list = await kickFetchJson<any>(
        `${KICK_API}/channels/${encodeURIComponent(channelSlug)}/videos`,
        'Kick did not return this channel’s VODs.'
      );
      const entries: any[] = Array.isArray(list) ? list : list?.data || [];
      entry = entries.find((item) => (item?.video?.uuid || '').toLowerCase() === videoId) || null;
    } catch {
      entry = null;
    }
  }

  const session = playback?.video_session;
  const masterUrl = playback?.playback_url?.vod || entry?.source || '';
  const pageUrl = channelSlug
    ? `${KICK_ORIGIN}/${channelSlug}/videos/${videoId}`
    : `${KICK_ORIGIN}/video/${videoId}`;

  if (!/^https?:\/\//i.test(masterUrl)) {
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

  const variants = parseMasterPlaylist(await kickFetchText(masterUrl), masterUrl);
  if (variants.length === 0) throw new KickError('Kick published no downloadable quality for this VOD.', 502);

  const durationMs = entry?.duration || 0;
  const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : session?.video_duration || 0;
  const duration =
    durationSec > 0
      ? `${Math.floor(durationSec / 3600)}:${String(Math.floor((durationSec % 3600) / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`
      : '';

  const thumbnail = pickThumbnail(entry, playback);
  const author = entry?.channel?.username || session?.video_series || channelSlug || 'kick';
  const title =
    (entry?.session_title || session?.video_title || '').trim().substring(0, MAX_TEXT) || `Kick VOD ${videoId}`;
  const fileBase = `igsavego_kick_vod_${videoId.slice(0, 8)}_${author.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30)}`;

  return {
    kind: 'vod' as const,
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
    note: 'A Kick VOD is one HLS stream of several gigabytes split into thousands of short segments, so no browser or edge function can hand it over as one MP4 without re-encoding. These are the exact quality playlists Kick serves for this VOD; open one in VLC/MPV, or run the yt-dlp command to save a single file. The VOD thumbnail is downloadable here.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (checkRateLimit(req, 'kick', 30, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const rawUrl = String((req.query.url as string) || req.body?.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error:
        'Paste a public Kick clip or VOD link, for example https://kick.com/xqc?clip=clip_01H811MXG4FBR62FXPE1AXABDH',
    });
  }
  if (rawUrl.length > 2048) return res.status(414).json({ error: 'URL is too long.' });

  try {
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

    const result = target.kind === 'clip' ? await extractClip(target.clipId) : await extractVod(target.slug, target.videoId);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof KickError) return res.status(error.status).json({ error: error.message });
    console.error('Kick extraction error:', error);
    return res.status(502).json({ error: 'Could not read that Kick link. Please check it and try again.' });
  }
}
