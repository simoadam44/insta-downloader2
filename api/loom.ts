import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the Loom
// logic is inlined here. Keep it in sync with lib/loomExtract.ts, which is the
// source used by Cloudflare Pages Functions and server.ts.)
//
// A public Loom share page is a shell: the recording is served from cdn.loom.com
// behind a signed URL that Loom's own web app obtains from Loom's public GraphQL
// API. This function makes the same two read-only calls the share page makes —
// GetVideoSSR for the metadata and GetVideoSource for the MP4 — which is also
// how the open-source yt-dlp Loom extractor works. No cookie or key is used.

const LOOM_ORIGIN = 'https://www.loom.com';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const APOLLO_GRAPHQL_VERSION = '45a5bd4';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const VIDEO_ID = '[0-9a-fA-F]{32}';

class LoomError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'LoomError';
    this.status = status;
  }
}

function parseLoomUrl(rawInput: string): { videoId: string; pageUrl: string } | null {
  const input = (rawInput || '').trim();
  if (!input) return null;
  if (new RegExp(`^${VIDEO_ID}$`).test(input)) {
    return { videoId: input.toLowerCase(), pageUrl: `${LOOM_ORIGIN}/share/${input.toLowerCase()}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'loom.com' && host !== 'www.loom.com') return null;

  if (/^\/share\/folder\/[0-9a-fA-F]{32}/.test(parsed.pathname)) {
    throw new LoomError(
      'That is a Loom folder link. Open the recording you want (its link looks like https://www.loom.com/share/<32-character id>) and paste that instead.',
      400
    );
  }

  const match = parsed.pathname.match(new RegExp(`^/(?:share|embed|s)/(${VIDEO_ID})/?$`));
  if (match) {
    const videoId = match[1].toLowerCase();
    return { videoId, pageUrl: `${LOOM_ORIGIN}/share/${videoId}` };
  }

  return null;
}

function formatDuration(seconds: number): string {
  const total = Math.round(Number(seconds) || 0);
  if (!total) return '';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, '0');
  const ss = String(secs).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function proxied(url: string, filename: string): string {
  return `/api/proxy-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

function safeName(value: string): string {
  return (value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const GET_VIDEO_SSR = `query GetVideoSSR($videoId: ID!, $password: String) {
  getVideo(id: $videoId, password: $password) {
    __typename
    ... on PrivateVideo { id status message __typename }
    ... on VideoPasswordMissingOrIncorrect { id message __typename }
    ... on RegularUserVideo {
      id
      createdAt
      description
      download_enabled
      is_protected
      needs_password
      owner { display_name __typename }
      name
      video_properties { duration width height __typename }
      playable_duration
      visibility
      __typename
    }
  }
}`;

const GET_VIDEO_SOURCE = `query GetVideoSource($videoId: ID!, $password: String, $acceptableMimes: [CloudfrontVideoAcceptableMime]) {
  getVideo(id: $videoId, password: $password) {
    ... on RegularUserVideo {
      id
      nullableRawCdnUrl(acceptableMimes: $acceptableMimes, password: $password) {
        url
        __typename
      }
      __typename
    }
    __typename
  }
}`;

async function loomGraphql(
  operationName: 'GetVideoSSR' | 'GetVideoSource',
  videoId: string,
  variables: Record<string, unknown> = {}
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${LOOM_ORIGIN}/graphql`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: LOOM_ORIGIN,
        Referer: `${LOOM_ORIGIN}/share/${videoId}`,
        'User-Agent': USER_AGENT,
        'x-loom-request-source': `loom_web_${APOLLO_GRAPHQL_VERSION}`,
        'apollographql-client-name': 'web',
        'apollographql-client-version': APOLLO_GRAPHQL_VERSION,
        'graphql-operation-name': operationName,
      },
      body: JSON.stringify({
        operationName,
        variables: { videoId, password: null, ...variables },
        query: operationName === 'GetVideoSSR' ? GET_VIDEO_SSR : GET_VIDEO_SOURCE,
      }),
    });

    if (!response.ok) {
      throw new LoomError(`Loom returned HTTP ${response.status} for that recording.`, 502);
    }

    const text = await response.text();
    const body = text.length > MAX_RESPONSE_BYTES ? text.slice(0, MAX_RESPONSE_BYTES) : text;
    try {
      return JSON.parse(body);
    } catch {
      throw new LoomError('Loom returned an unreadable response. Please try again in a minute.', 502);
    }
  } catch (error) {
    if (error instanceof LoomError) throw error;
    throw new LoomError('Could not reach Loom for that recording. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function extractLoom(rawUrl: string) {
  const target = parseLoomUrl(rawUrl);
  if (!target) {
    throw new LoomError(
      'That is not a Loom video link. Paste a link such as https://www.loom.com/share/44bff3b7cd784946a61686092a353f48',
      400
    );
  }

  const { videoId } = target;
  const metaResponse = await loomGraphql('GetVideoSSR', videoId);
  const video = metaResponse?.data?.getVideo;
  if (!video) {
    throw new LoomError(
      'Loom did not return that recording. It may be deleted, private, or limited to the owner’s workspace.',
      404
    );
  }

  if (video.__typename === 'VideoPasswordMissingOrIncorrect') {
    throw new LoomError(
      'That Loom recording is password-protected. Open it in Loom, enter the password, and download it there — this tool only reads public links.',
      401
    );
  }

  if (video.__typename === 'PrivateVideo') {
    throw new LoomError(video.message || 'That Loom recording is private, so its media is not public.', 403);
  }

  if (video.__typename !== 'RegularUserVideo') {
    throw new LoomError('Loom returned an unsupported recording type for that link.', 404);
  }

  if (video.needs_password) {
    throw new LoomError(
      'That Loom recording needs a password, so this tool cannot read it. Download it from Loom instead.',
      401
    );
  }

  const sourceResponse = await loomGraphql('GetVideoSource', videoId, { acceptableMimes: ['MP4'] });
  const mp4Url: string = sourceResponse?.data?.getVideo?.nullableRawCdnUrl?.url || '';

  if (!mp4Url) {
    throw new LoomError(
      'Loom does not publish an MP4 for that recording (some older or very large videos are served only as an HLS stream). The open-source yt-dlp tool can still save it: yt-dlp ' +
        `${LOOM_ORIGIN}/share/${videoId}`,
      409
    );
  }

  const properties = video.video_properties || {};
  const seconds = Number(properties.duration) || Number(video.playable_duration) || 0;
  const width = Number(properties.width) || 0;
  const height = Number(properties.height) || 0;
  const title = String(video.name || '').trim().slice(0, 200) || `Loom recording ${videoId}`;
  const owner = String(video.owner?.display_name || '').trim().slice(0, 120) || 'Loom creator';
  const base = `loom_${videoId}_${safeName(title) || 'video'}`;
  const cover = `https://cdn.loom.com/sessions/thumbnails/${videoId}-00001.jpg`;
  const createdAt = String(video.createdAt || '');
  const published = createdAt ? new Date(createdAt) : null;
  const durationText = formatDuration(seconds);

  return {
    id: videoId,
    title,
    description: String(video.description || '').trim().slice(0, 2000),
    pageUrl: `${LOOM_ORIGIN}/share/${videoId}`,
    author: { name: owner, handle: '', avatar: '' },
    cover: proxied(cover, `${base}_thumbnail.jpg`),
    coverDownload: proxied(cover, `${base}_thumbnail.jpg`),
    media: [
      {
        type: 'video',
        url: mp4Url,
        downloadUrl: proxied(mp4Url, `${base}.mp4`),
        filename: `${base}.mp4`,
        width,
        height,
        duration: durationText,
      },
    ],
    duration: durationText,
    durationSeconds: seconds,
    dimensions: width && height ? `${width} × ${height}` : '',
    createdAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : '',
    note:
      'This is the MP4 Loom itself serves for the recording. The signed CDN link expires, so download now; nothing is re-encoded, cropped or watermarked here.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const rawUrl = String((req.query.url as string) || (req.body && req.body.url) || '').trim();
  if (!rawUrl) {
    return res.status(400).json({
      error:
        'Paste a public Loom video link, for example https://www.loom.com/share/44bff3b7cd784946a61686092a353f48',
    });
  }
  if (rawUrl.length > 2048) {
    return res.status(414).json({ error: 'URL is too long.' });
  }

  try {
    const result = await extractLoom(rawUrl);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof LoomError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Loom extraction error:', error);
    return res
      .status(502)
      .json({ error: 'Could not read that Loom recording. Please check the link and try again.' });
  }
}
