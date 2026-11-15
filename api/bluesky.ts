import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the
// Bluesky logic is inlined here. Keep it in sync with lib/blueskyExtract.ts,
// which is the source used by Cloudflare Pages Functions and server.ts.)

const APPVIEW = 'https://public.api.bsky.app';
const PLC = 'https://plc.directory';
const FALLBACK_PDS = 'https://bsky.social';
const TIMEOUT_MS = 9000;

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

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().substring(0, max) : '';
}

function num(value: unknown): number | null {
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
  return `${unit === 0 ? Math.round(value) : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatCount(value: unknown): string {
  const n = num(value);
  if (n === null) return '';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatDate(iso: unknown): string {
  const value = text(iso, 40);
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function extensionFor(mime: string, fallback: 'mp4' | 'jpg'): 'mp4' | 'jpg' | 'png' | 'webp' {
  const m = mime.toLowerCase();
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return fallback;
}

async function fetchJson(url: string, timeoutMs = TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'IGSaveGo/1.0 (+https://www.igsavego.com/bluesky-downloader)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error('not-found');
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function parsePostUrl(rawInput: string): { actor: string; rkey: string } | null {
  const input = (rawInput || '').trim();
  if (!input || input.length > 2048) return null;

  if (/^at:\/\//i.test(input)) {
    const m = input.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)\/?$/i);
    return m ? { actor: m[1], rkey: m[2] } : null;
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
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 4) return null;
  if (segments[0].toLowerCase() !== 'profile' || segments[2].toLowerCase() !== 'post') return null;
  try {
    const actor = decodeURIComponent(segments[1]);
    const rkey = decodeURIComponent(segments[3]);
    if (!/^(did:[a-z]+:.+|[A-Za-z0-9._-]{1,253})$/.test(actor)) return null;
    if (!/^[A-Za-z0-9._~-]{1,120}$/.test(rkey)) return null;
    return { actor, rkey };
  } catch {
    return null;
  }
}

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

const pdsCache = new Map<string, { endpoint: string; expires: number }>();

async function resolvePds(did: string): Promise<string> {
  const cached = pdsCache.get(did);
  if (cached && cached.expires > Date.now()) return cached.endpoint;

  let endpoint = FALLBACK_PDS;
  if (did.startsWith('did:plc:')) {
    try {
      const doc = await fetchJson(`${PLC}/${encodeURIComponent(did)}`, 6000);
      const services = Array.isArray(doc?.service) ? doc.service : doc?.service ? [doc.service] : [];
      for (const service of services) {
        const id = text(service?.id, 80);
        const candidate = text(service?.serviceEndpoint, 300);
        if (id.endsWith('#atproto_pds') && isSafeHttpsEndpoint(candidate)) {
          endpoint = candidate.replace(/\/+$/, '');
          break;
        }
      }
    } catch {
      /* fallback */
    }
  }

  if (pdsCache.size > 500) pdsCache.clear();
  pdsCache.set(did, { endpoint, expires: Date.now() + 60 * 60 * 1000 });
  return endpoint;
}

function isProxyableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ['bsky.app', 'bsky.network', 'bsky.social'].some((root) => host === root || host.endsWith(`.${root}`));
}

function proxied(url: string, filename: string): string {
  return `/api/proxy-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

function safeHandle(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '').slice(0, 60) || 'bluesky';
}

function blobFromRecord(value: any) {
  const cid = text(value?.ref?.$link, 200);
  if (!cid) return null;
  return {
    cid,
    mime: text(value?.mimeType, 100) || 'application/octet-stream',
    size: num(value?.size),
    alt: text(value?.alt, 1000),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (checkRateLimit(req, 'bluesky', 30, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const rawUrl = String((req.query.url as string) || req.body?.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error: 'Paste a public Bluesky post link, for example https://bsky.app/profile/name.bsky.social/post/3kabc123xyz',
    });
  }
  if (rawUrl.length > 2048) return res.status(414).json({ error: 'URL is too long.' });

  const ref = parsePostUrl(rawUrl);
  if (!ref) {
    return res.status(400).json({
      error: 'Enter a public Bluesky post link, for example https://bsky.app/profile/name.bsky.social/post/3kabc123xyz',
    });
  }

  try {
    let did = ref.actor;
    if (!did.startsWith('did:')) {
      const handle = ref.actor.replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9.-]{1,253}$/.test(handle)) {
        return res.status(400).json({ error: 'That Bluesky handle is not valid.' });
      }
      let resolved: any;
      try {
        resolved = await fetchJson(
          `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
        );
      } catch {
        return res
          .status(404)
          .json({ error: 'Bluesky could not resolve that handle. Check the profile name and try again.' });
      }
      did = text(resolved?.did, 200);
      if (!did.startsWith('did:')) {
        return res.status(404).json({ error: 'Bluesky could not resolve that handle. Check the profile name and try again.' });
      }
    }

    const atUri = `at://${did}/app.bsky.feed.post/${ref.rkey}`;
    let thread: any;
    try {
      thread = await fetchJson(
        `${APPVIEW}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0&parentHeight=0`
      );
    } catch {
      return res.status(404).json({
        error: 'Bluesky did not return this post. It may be deleted, blocked by its author, or only visible to logged-in users.',
      });
    }
    const post = thread?.thread?.post;
    if (!post || !post?.record) {
      return res.status(404).json({
        error: 'Bluesky did not return this post. It may be deleted, blocked by its author, or only visible to logged-in users.',
      });
    }

    const record = post.record;
    const author = post.author || {};
    const handle = text(author.handle, 120) || did;

    let recordEmbed = record?.embed;
    let viewEmbed = post?.embed;
    if (recordEmbed?.$type === 'app.bsky.embed.recordWithMedia') recordEmbed = recordEmbed.media;
    if (viewEmbed?.$type === 'app.bsky.embed.recordWithMedia#view') viewEmbed = viewEmbed.media;

    const videoBlob =
      recordEmbed?.$type === 'app.bsky.embed.video' ? blobFromRecord(recordEmbed.video) : null;
    const imageRecords =
      recordEmbed?.$type === 'app.bsky.embed.images' && Array.isArray(recordEmbed.images)
        ? recordEmbed.images
        : [];
    const viewImages = Array.isArray(viewEmbed?.images) ? viewEmbed.images : [];

    if (!videoBlob && imageRecords.length === 0) {
      return res.status(404).json({
        error:
          'This Bluesky post has no video or images to download. Text-only posts, link cards and quoted posts are not supported — open the post that contains the media and paste its link.',
      });
    }

    const pds = await resolvePds(did);
    const fileBase = `igsavego_bluesky_${safeHandle(handle)}_${safeHandle(ref.rkey)}`;
    const blobUrl = (cid: string) =>
      `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
    const items: any[] = [];
    let usedDirectLink = false;

    if (videoBlob) {
      const source = blobUrl(videoBlob.cid);
      let proxyable = false;
      try {
        proxyable = isProxyableHost(new URL(source).hostname);
      } catch {
        proxyable = false;
      }
      if (!proxyable) usedDirectLink = true;
      const downloadUrl = proxyable ? proxied(source, `${fileBase}.mp4`) : source;
      const sizeLabel = formatBytes(videoBlob.size);
      const aspect =
        num(recordEmbed?.aspectRatio?.width) && num(recordEmbed?.aspectRatio?.height)
          ? `${recordEmbed.aspectRatio.width}:${recordEmbed.aspectRatio.height}`
          : '';
      items.push({
        id: `item_${ref.rkey}_1`,
        type: 'video',
        url: downloadUrl,
        downloadUrl,
        thumbnail: text(viewEmbed?.thumbnail, 600),
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

    imageRecords.forEach((entry: any, index: number) => {
      const blob = blobFromRecord(entry?.image);
      if (!blob) return;
      const source = blobUrl(blob.cid);
      let proxyable = false;
      try {
        proxyable = isProxyableHost(new URL(source).hostname);
      } catch {
        proxyable = false;
      }
      if (!proxyable) usedDirectLink = true;
      const format = extensionFor(blob.mime, 'jpg');
      const downloadUrl = proxyable ? proxied(source, `${fileBase}_${index + 1}.${format}`) : source;
      const sizeLabel = formatBytes(blob.size);
      const fullsize = text(viewImages[index]?.fullsize, 600);
      const imageAspect =
        num(viewImages[index]?.aspectRatio?.width) && num(viewImages[index]?.aspectRatio?.height)
          ? `${viewImages[index].aspectRatio.width}:${viewImages[index].aspectRatio.height}`
          : '';
      items.push({
        id: `item_${ref.rkey}_${index + 1}`,
        type: 'photo',
        url: fullsize || downloadUrl,
        downloadUrl,
        thumbnail: text(viewImages[index]?.thumb, 600) || fullsize,
        quality: blob.alt || 'Original image',
        dimensions: imageAspect,
        fileSize: sizeLabel,
        format,
        availableQualities: [
          {
            id: 'original',
            label: `Original image (${format.toUpperCase()})`,
            quality: 'original',
            resolution: imageAspect ? `Aspect ratio ${imageAspect}` : '',
            fileSize: sizeLabel,
            downloadUrl,
            format,
          },
        ],
      });
    });

    return res.status(200).json({
      id: ref.rkey,
      mediaType: videoBlob ? 'video' : 'photo',
      originalUrl: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${ref.rkey}`,
      author: {
        username: handle,
        fullName: text(author.displayName, 120) || handle,
        avatar: text(author.avatar, 600),
        isVerified: text(author?.verification?.verifiedStatus, 20) === 'valid',
      },
      caption: text(record?.text, 600) || `Bluesky post by @${handle}`,
      timestamp: formatDate(record?.createdAt),
      likes: formatCount(post?.likeCount),
      comments: formatCount(post?.replyCount),
      provider: 'bluesky-atproto',
      ...(usedDirectLink
        ? {
            note: 'This account is hosted on a third-party PDS, so the file is served directly by that server instead of being proxied.',
          }
        : {}),
      items,
    });
  } catch {
    return res.status(502).json({ error: 'Bluesky did not respond. Please try again in a minute.' });
  }
}
