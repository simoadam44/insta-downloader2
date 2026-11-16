// Bluesky (AT Protocol) media extractor shared by every host:
//   - functions/api/bluesky.ts  (Cloudflare Pages Functions)
//   - api/bluesky.ts            (Vercel)
//   - server.ts                 (Express dev / Docker)
//
// Why the public AppView and not HTML scraping:
//   A bsky.app post URL contains the author handle (or DID) and the record key.
//   `app.bsky.feed.getPostThread` on public.api.bsky.app returns the public post
//   view and its raw record without any authentication. The record carries the
//   blob CIDs of the original uploads, and `com.atproto.sync.getBlob` on the
//   author's PDS returns those exact files (video/mp4, image/jpeg, ...).
//
//   That means the MP4 we hand over is the file the author uploaded — not a
//   screen recording and not a re-encoded HLS rendition (the playlist.m3u8 URL
//   in the view is segmented video, which would need server-side remuxing).
//
// No API key, no login, no cookies. Only two fixed upstream hosts are
// contacted (public.api.bsky.app and the PLC directory / PDS from the DID
// document), so user input can never choose the fetch target.
//
// This module is dependency-free and uses only `fetch`, so the same code runs
// on Workers (no Node builtins) and on Node 24.

// Sizes, counts and dates are shared with the LinkedIn extractor.
import { formatBytes, formatCount, formatDate } from './mediaFormat';
export { formatBytes, formatCount };

export const BSKY_APPVIEW = 'https://public.api.bsky.app';
export const BSKY_PLC_DIRECTORY = 'https://plc.directory';
/** Fallback PDS used only when a DID document cannot be resolved. */
const BSKY_FALLBACK_PDS = 'https://bsky.social';

const MAX_INPUT = 2048;
const FETCH_TIMEOUT_MS = 9000;
const MAX_TEXT = 600;
const MAX_ALT = 1000;

export class BlueskyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BlueskyError';
    this.status = status;
  }
}

export interface BlueskyPostRef {
  /** Handle from the URL, or the DID when the URL contains one. */
  actor: string;
  /** Record key of the app.bsky.feed.post record. */
  rkey: string;
}

export interface BlueskyQuality {
  id: string;
  label: string;
  quality: 'original';
  resolution: string;
  fileSize: string;
  downloadUrl: string;
  format: 'mp4' | 'jpg' | 'png' | 'webp';
  isFullHd?: boolean;
  bitrate?: string;
}

export interface BlueskyItem {
  id: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail: string;
  downloadUrl: string;
  quality: string;
  dimensions: string;
  fileSize: string;
  format: 'mp4' | 'jpg' | 'png' | 'webp';
  availableQualities: BlueskyQuality[];
}

export interface BlueskyResult {
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
  provider: 'bluesky-atproto';
  note?: string;
  items: BlueskyItem[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Accepts:
 *   https://bsky.app/profile/{handle-or-did}/post/{rkey}
 *   at://{did}/app.bsky.feed.post/{rkey}
 * Anything else (profiles, feeds, lists, search, other hosts) is rejected so
 * the UI can explain what is actually supported instead of guessing.
 */
export function parseBlueskyPostUrl(rawInput: string): BlueskyPostRef | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > MAX_INPUT) return null;

  if (/^at:\/\//i.test(input)) {
    const m = input.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)\/?$/i);
    if (!m) return null;
    return { actor: m[1], rkey: m[2] };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  if (host !== 'bsky.app' && host !== 'www.bsky.app') return null;

  // /profile/{actor}/post/{rkey}  — actor may be a handle or a did:plc:/did:web:
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 4) return null;
  if (segments[0].toLowerCase() !== 'profile' || segments[2].toLowerCase() !== 'post') return null;

  let actor = segments[1];
  let rkey = segments[3];
  try {
    actor = decodeURIComponent(actor);
    rkey = decodeURIComponent(rkey);
  } catch {
    return null;
  }
  if (!/^(did:[a-z]+:.+|[A-Za-z0-9._-]{1,253})$/.test(actor)) return null;
  if (!/^[A-Za-z0-9._~-]{1,120}$/.test(rkey)) return null;

  return { actor, rkey };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().substring(0, max) : '';
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function extensionFor(mime: string, fallback: 'mp4' | 'jpg'): 'mp4' | 'jpg' | 'png' | 'webp' {
  const m = mime.toLowerCase();
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return fallback;
}

async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'IGSaveGo/1.0 (+https://www.igsavego.com/bluesky-downloader)',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BlueskyError('Bluesky did not return this post. It may be deleted, blocked, or not public.', 404);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof BlueskyError) throw error;
    throw new BlueskyError('Bluesky did not respond in time. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// PDS resolution (where the original blob actually lives)
// ---------------------------------------------------------------------------

const pdsCache = new Map<string, { endpoint: string; expires: number }>();
const PDS_TTL_MS = 60 * 60 * 1000;

function isSafeHttpsEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolvePdsEndpoint(did: string): Promise<string> {
  const cached = pdsCache.get(did);
  if (cached && cached.expires > Date.now()) return cached.endpoint;

  let docUrl = '';
  if (did.startsWith('did:plc:')) {
    docUrl = `${BSKY_PLC_DIRECTORY}/${encodeURIComponent(did)}`;
  } else if (did.startsWith('did:web:')) {
    const host = did.slice('did:web:'.length).replace(/%3A/gi, ':');
    docUrl = `https://${host}/.well-known/did.json`;
  }

  let endpoint = BSKY_FALLBACK_PDS;
  if (docUrl) {
    try {
      const doc = await fetchJson(docUrl, 6000);
      const services = Array.isArray(doc?.service) ? doc.service : doc?.service ? [doc.service] : [];
      for (const service of services) {
        const id = str(service?.id, 80);
        const candidate = str(service?.serviceEndpoint, 300);
        if ((id.endsWith('#atproto_pds') || id === '#atproto_pds') && isSafeHttpsEndpoint(candidate)) {
          endpoint = candidate.replace(/\/+$/, '');
          break;
        }
      }
    } catch {
      // Keep the documented fallback; bsky.social serves its own accounts.
    }
  }

  if (pdsCache.size > 500) pdsCache.clear();
  pdsCache.set(did, { endpoint, expires: Date.now() + PDS_TTL_MS });
  return endpoint;
}

/** Hosts the /api/proxy-media allowlist accepts; others are linked directly. */
export function isProxyableBlueskyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const roots = ['bsky.app', 'bsky.network', 'bsky.social'];
  return roots.some((root) => host === root || host.endsWith(`.${root}`));
}

function proxied(mediaUrl: string, filename: string): string {
  return `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
}

function safeHandle(value: string): string {
  const handle = value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '');
  return handle.slice(0, 60) || 'bluesky';
}

// ---------------------------------------------------------------------------
// Media mapping
// ---------------------------------------------------------------------------

interface BlobRef {
  cid: string;
  mime: string;
  size: number | null;
  alt: string;
}

function blobFromRecord(value: any): BlobRef | null {
  const cid = str(value?.ref?.$link, 200);
  if (!cid) return null;
  return {
    cid,
    mime: str(value?.mimeType, 100) || 'application/octet-stream',
    size: num(value?.size),
    alt: str(value?.alt, MAX_ALT),
  };
}

/** Normalises record + view embeds, including recordWithMedia (quote + media). */
function readMediaEmbed(recordEmbed: any, viewEmbed: any): {
  video: { blob: BlobRef; aspect: string; thumb: string } | null;
  images: { blob: BlobRef; fullsize: string; thumb: string; aspect: string }[];
} {
  let record = recordEmbed;
  let view = viewEmbed;

  if (record?.$type === 'app.bsky.embed.recordWithMedia') record = record.media;
  if (view?.$type === 'app.bsky.embed.recordWithMedia#view') view = view.media;

  const result: {
    video: { blob: BlobRef; aspect: string; thumb: string } | null;
    images: { blob: BlobRef; fullsize: string; thumb: string; aspect: string }[];
  } = { video: null, images: [] };

  if (record?.$type === 'app.bsky.embed.video') {
    const blob = blobFromRecord(record.video);
    if (blob) {
      const aspect =
        num(record?.aspectRatio?.width) && num(record?.aspectRatio?.height)
          ? `${record.aspectRatio.width}:${record.aspectRatio.height}`
          : num(view?.aspectRatio?.width) && num(view?.aspectRatio?.height)
            ? `${view.aspectRatio.width}:${view.aspectRatio.height}`
            : '';
      result.video = {
        blob,
        aspect,
        thumb: str(view?.thumbnail, 600),
      };
    }
  }

  if (record?.$type === 'app.bsky.embed.images' && Array.isArray(record.images)) {
    const viewImages = Array.isArray(view?.images) ? view.images : [];
    record.images.forEach((entry: any, index: number) => {
      const blob = blobFromRecord(entry?.image);
      if (!blob) return;
      const viewImage = viewImages[index];
      const aspect =
        num(viewImage?.aspectRatio?.width) && num(viewImage?.aspectRatio?.height)
          ? `${viewImage.aspectRatio.width}:${viewImage.aspectRatio.height}`
          : '';
      result.images.push({
        blob,
        fullsize: str(viewImage?.fullsize, 600),
        thumb: str(viewImage?.thumb, 600),
        aspect,
      });
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a bsky.app post URL into a download descriptor.
 * Throws BlueskyError with a user-facing message on any failure.
 */
export async function extractBlueskyPost(
  rawUrl: string,
  options: { appview?: string } = {}
): Promise<BlueskyResult> {
  const ref = parseBlueskyPostUrl(rawUrl);
  if (!ref) {
    throw new BlueskyError(
      'Enter a public Bluesky post link, for example https://bsky.app/profile/name.bsky.social/post/3kabc123xyz',
      400
    );
  }

  const appview = (options.appview || BSKY_APPVIEW).replace(/\/+$/, '');

  // 1. Handle -> DID (a DID in the URL is used as-is).
  let did = ref.actor;
  if (!did.startsWith('did:')) {
    const handle = ref.actor.replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9.-]{1,253}$/.test(handle)) {
      throw new BlueskyError('That Bluesky handle is not valid.', 400);
    }
    const resolved = await fetchJson(
      `${appview}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    did = str(resolved?.did, 200);
    if (!did.startsWith('did:')) {
      throw new BlueskyError('Bluesky could not resolve that handle. Check the profile name and try again.', 404);
    }
  }

  // 2. Public post thread (no auth).
  const atUri = `at://${did}/app.bsky.feed.post/${ref.rkey}`;
  const thread = await fetchJson(
    `${appview}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0&parentHeight=0`
  );

  const post = thread?.thread?.post;
  if (!post || !post?.record) {
    throw new BlueskyError(
      'Bluesky did not return this post. It may be deleted, blocked by its author, or only visible to logged-in users.',
      404
    );
  }

  const record = post.record;
  const author = post.author || {};
  const handle = str(author.handle, 120) || did;
  const recordEmbed = record?.embed;
  const viewEmbed = post?.embed;
  const media = readMediaEmbed(recordEmbed, viewEmbed);

  if (!media.video && media.images.length === 0) {
    throw new BlueskyError(
      'This Bluesky post has no video or images to download. Text-only posts, link cards and quoted posts are not supported — open the post that contains the media and paste its link.',
      404
    );
  }

  const pds = await resolvePdsEndpoint(did);
  const canonicalUrl = `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${ref.rkey}`;
  const fileBase = `igsavego_bluesky_${safeHandle(handle)}_${safeHandle(ref.rkey)}`;
  const items: BlueskyItem[] = [];
  let usedDirectLink = false;

  const blobUrl = (cid: string): string =>
    `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;

  if (media.video) {
    const { blob, aspect, thumb } = media.video;
    const source = blobUrl(blob.cid);
    let host = '';
    try {
      host = new URL(source).hostname;
    } catch {
      host = '';
    }
    const proxyable = host ? isProxyableBlueskyHost(host) : false;
    if (!proxyable) usedDirectLink = true;
    const downloadUrl = proxyable ? proxied(source, `${fileBase}.mp4`) : source;
    const sizeLabel = formatBytes(blob.size);
    items.push({
      id: `item_${ref.rkey}_1`,
      type: 'video',
      url: downloadUrl,
      downloadUrl,
      thumbnail: thumb || '',
      quality: 'Original upload',
      dimensions: aspect,
      fileSize: sizeLabel,
      format: 'mp4',
      availableQualities: [
        {
          id: 'original',
          label: 'Original upload (MP4)',
          quality: 'original',
          resolution: aspect ? `Aspect ratio ${aspect}` : '',
          fileSize: sizeLabel,
          downloadUrl,
          format: 'mp4',
          bitrate: 'Original file, no re-encode',
        },
      ],
    });
  }

  media.images.forEach((image, index) => {
    const source = blobUrl(image.blob.cid);
    let host = '';
    try {
      host = new URL(source).hostname;
    } catch {
      host = '';
    }
    const proxyable = host ? isProxyableBlueskyHost(host) : false;
    if (!proxyable) usedDirectLink = true;
    const format = extensionFor(image.blob.mime, 'jpg');
    const downloadUrl = proxyable ? proxied(source, `${fileBase}_${index + 1}.${format}`) : source;
    const sizeLabel = formatBytes(image.blob.size);
    items.push({
      id: `item_${ref.rkey}_${index + 1}`,
      type: 'photo',
      url: image.fullsize || image.thumb || downloadUrl,
      downloadUrl,
      thumbnail: image.thumb || image.fullsize || '',
      quality: image.blob.alt || 'Original image',
      dimensions: image.aspect,
      fileSize: sizeLabel,
      format,
      availableQualities: [
        {
          id: 'original',
          label: `Original image (${format.toUpperCase()})`,
          quality: 'original',
          resolution: image.aspect ? `Aspect ratio ${image.aspect}` : '',
          fileSize: sizeLabel,
          downloadUrl,
          format,
        },
      ],
    });
  });

  const caption = str(record?.text, MAX_TEXT) || `Bluesky post by @${handle}`;
  const note = usedDirectLink
    ? 'This account is hosted on a third-party PDS, so the file is served directly by that server instead of being proxied.'
    : undefined;

  return {
    id: ref.rkey,
    mediaType: media.video ? 'video' : 'photo',
    originalUrl: canonicalUrl,
    author: {
      username: handle,
      fullName: str(author.displayName, 120) || handle,
      avatar: str(author.avatar, 600),
      isVerified: str(author?.verification?.verifiedStatus, 20) === 'valid',
    },
    caption,
    timestamp: formatDate(record?.createdAt),
    likes: formatCount(post?.likeCount),
    comments: formatCount(post?.replyCount),
    provider: 'bluesky-atproto',
    ...(note ? { note } : {}),
    items,
  };
}
