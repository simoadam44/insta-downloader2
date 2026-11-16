import { getApiBaseUrl } from './extractorService';

// Client-side half of the Kick downloader.
//
// The check below only decides whether the pasted link *looks* like a Kick
// clip, VOD or live channel; the server (lib/kickExtract.ts) is the authority on
// what it can return, and its message explains any refusal.

/** A public clip and a public VOD used by the example buttons. */
export const KICK_CLIP_DEMO_URL = 'https://kick.com/xqc?clip=clip_01H811MXG4FBR62FXPE1AXABDH';
export const KICK_VOD_DEMO_URL = 'https://kick.com/xqc/videos/371f0495-9aaa-4e7a-b88e-22b50c6194b0';

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
  fileSize: string;
  downloadUrl: string;
  filename: string;
  pageUrl: string;
  thumbnailUrl: string;
  thumbnailDownload: string;
  note: string;
}

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
  ytdlp: string;
  note: string;
}

export type KickResult = KickClipResult | KickVodResult;

const CLIP_PATTERN = /clip_[A-Za-z0-9]{8,}/;
const UUID_PATTERN = /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
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

export function detectKickUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) return { isValid: false, error: 'Paste a Kick clip or VOD link first.' };

  if (/^clip_[A-Za-z0-9]{8,}$/.test(trimmed)) return { isValid: true };
  if (UUID_PATTERN.test(trimmed) && !/kick\.com/i.test(trimmed)) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid kick.com URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'kick.com' && !host.endsWith('.kick.com')) {
    return {
      isValid: false,
      error: 'Only kick.com links are supported, for example https://kick.com/<channel>?clip=clip_…',
    };
  }

  const path = parsed.pathname;
  if (parsed.searchParams.get('clip') && CLIP_PATTERN.test(parsed.searchParams.get('clip') || '')) {
    return { isValid: true };
  }
  if (/^\/(?:[\w.-]+\/)?clips?\/clip_[A-Za-z0-9]{8,}/i.test(path)) return { isValid: true };
  if (/^\/[\w.-]{2,40}\/videos\/[0-9a-f-]{36}/i.test(path)) return { isValid: true };
  if (/^\/video\/[0-9a-f-]{36}/i.test(path)) return { isValid: true };

  const channel = path.match(/^\/([\w.-]{2,40})\/?$/);
  if (channel && !RESERVED_SLUGS.has(channel[1].toLowerCase())) {
    return {
      isValid: false,
      error:
        'That is a live channel link, and a live broadcast never ends — there is no single file to save. Paste a clip link (?clip=…) or a VOD link (/<channel>/videos/<id>).',
    };
  }

  return {
    isValid: false,
    error:
      'That Kick link is not a clip or a VOD. Category, search and settings pages cannot be downloaded — open the clip or the VOD itself and copy its link.',
  };
}

export interface KickVodJobStatus {
  id: string;
  state: 'preparing' | 'downloading' | 'done' | 'error';
  percent: number;
  bytes: number;
  label: string;
  filename: string;
  error: string;
  downloadUrl: string;
}

/**
 * Starts building a VOD as one MP4 on the server and returns the job id. The
 * server remuxes Kick's HLS segments with ffmpeg, so the browser can then save
 * a normal file with an exact length and a percentage.
 */
export async function startKickVodDownload(pageUrl: string, quality: string): Promise<string> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/kick-vod/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url: pageUrl, q: quality }),
  });
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json().catch(() => null)
    : null;
  if (!payload?.id) {
    // A host without the Node build (Cloudflare Pages) has no /api/kick-vod
    // route and falls back to the app shell, so say that plainly instead of
    // reporting a bogus HTTP 200.
    if (!payload && response.ok) {
      throw new Error(
        'Building a whole VOD into one MP4 needs the Node server build, which this deployment does not run. Use a quality playlist below or the yt-dlp command instead.'
      );
    }
    throw new Error(payload?.error || `Could not start the download (HTTP ${response.status}).`);
  }
  return String(payload.id);
}

/** Progress of a VOD download job (percent is computed from the segments done). */
export async function fetchKickVodStatus(id: string): Promise<KickVodJobStatus> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/kick-vod/status?id=${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `Could not read the download status (HTTP ${response.status}).`);
  }
  return payload as KickVodJobStatus;
}

/** The finished MP4: a plain file with Content-Length, so it shows a percentage. */
export function kickVodFileUrl(id: string): string {
  return `${getApiBaseUrl()}/api/kick-vod/file?id=${encodeURIComponent(id)}`;
}

/**
 * Calls /api/kick and returns either a clip descriptor (one downloadable file)
 * or a VOD descriptor (its real variant playlists). Download paths are relative
 * to the API host, so they get the configured API base prefixed.
 */
export async function extractKickMedia(rawUrl: string): Promise<KickResult> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectKickUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Kick link.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/kick?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch {
    throw new Error('Could not reach the Kick extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
    throw new Error(payload?.error || `Kick extraction failed (HTTP ${response.status}). Please try again.`);
  }

  const result = (await response.json()) as KickResult;
  const fix = (url: string) => (url.startsWith('/api/') && apiBase ? `${apiBase}${url}` : url);

  if (result.kind === 'clip') {
    return {
      ...result,
      downloadUrl: fix(result.downloadUrl),
      thumbnailUrl: fix(result.thumbnailUrl),
      thumbnailDownload: fix(result.thumbnailDownload),
    };
  }

  if (result.kind === 'vod') {
    return {
      ...result,
      thumbnail: fix(result.thumbnail),
      thumbnailDownload: fix(result.thumbnailDownload),
    };
  }

  throw new Error('Kick returned an unexpected response. Please try again.');
}
