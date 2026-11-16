import type { VercelRequest, VercelResponse } from '@vercel/node';

// SELF-CONTAINED Vercel function — zero local-file imports.
// (Vercel fails to bundle relative local imports in this project, so the Lemon8
// logic is inlined here. Keep it in sync with lib/lemon8Extract.ts, which is the
// source used by Cloudflare Pages Functions and server.ts.)
//
// Lemon8's public post page is a Remix app that renders the post's own data into
// <script type="application/json" data-ttark="__remixContext">…</script> as a
// URL-encoded JSON blob. That blob carries the gallery image URLs and, for a
// video post, the direct MP4 on tiktokcdn — the media a yt-dlp-style tool would
// fetch — with no cookie, token or API key.

const LEMON8_ORIGIN = 'https://www.lemon8-app.com';
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

class Lemon8Error extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'Lemon8Error';
    this.status = status;
  }
}

function parseLemon8Url(input: string): { pageUrl: string; postId: string; handle: string } | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (/^\d{15,25}$/.test(raw)) {
    return { postId: raw, handle: '', pageUrl: `${LEMON8_ORIGIN}/` };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^m\./, 'www.');
  if (host !== 'www.lemon8-app.com' && host !== 'lemon8-app.com') return null;

  const params = parsed.searchParams;
  const fromParam = params.get('post_id') || params.get('item_id') || params.get('article_id') || '';
  if (/^\d{15,25}$/.test(fromParam)) {
    return { postId: fromParam, handle: '', pageUrl: `${LEMON8_ORIGIN}/` };
  }

  const match = parsed.pathname.match(/^\/@([\w.\-]{1,60})\/(\d{15,25})\/?$/);
  if (match) {
    const region = params.get('region');
    return {
      postId: match[2],
      handle: match[1],
      pageUrl: `${LEMON8_ORIGIN}/@${match[1]}/${match[2]}${region ? `?region=${encodeURIComponent(region)}` : ''}`,
    };
  }

  if (/^\/@[\w.\-]{1,60}\/?$/.test(parsed.pathname)) {
    throw new Lemon8Error(
      'That is a Lemon8 profile link. Open the post itself (its link looks like https://www.lemon8-app.com/@name/7012345678901234567) and paste that instead.',
      400
    );
  }

  return null;
}

function formatCount(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  if (num < 1000) return String(Math.round(num));
  if (num < 1_000_000) return `${(num / 1000).toFixed(num < 10_000 ? 1 : 0)}K`;
  return `${(num / 1_000_000).toFixed(1)}M`;
}

function formatDuration(seconds: unknown): string {
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

function extensionFor(url: string, type: 'video' | 'image'): string {
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = '';
  }
  const match = pathname.match(/\.(mp4|webm|mov|webp|jpe?g|png|avif)$/);
  if (match) return match[1] === 'jpeg' ? 'jpg' : match[1];
  return type === 'video' ? 'mp4' : 'jpg';
}

async function fetchPageHtml(pageUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(pageUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${LEMON8_ORIGIN}/`,
      },
    });
    if (response.status === 404) {
      throw new Lemon8Error('Lemon8 returned 404 for that post: it was deleted or the link is wrong.', 404);
    }
    if (!response.ok) {
      throw new Lemon8Error(
        `Lemon8 returned HTTP ${response.status} for that post.`,
        response.status === 403 ? 403 : 502
      );
    }
    const text = await response.text();
    return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
  } catch (error) {
    if (error instanceof Lemon8Error) throw error;
    throw new Lemon8Error('Could not reach Lemon8 for that post. Please try again in a minute.', 502);
  } finally {
    clearTimeout(timer);
  }
}

function readRemixState(html: string): any | null {
  const match = html.match(/data-ttark="__remixContext"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

function findPostDetail(state: any, postId: string): any | null {
  const loaderData = state?.state?.loaderData;
  if (!loaderData || typeof loaderData !== 'object') return null;

  const search = (node: any): any | null => {
    if (!node || typeof node !== 'object') return null;
    for (const [key, value] of Object.entries(node)) {
      if (/ArticleDetail/.test(key) && value && typeof value === 'object' && (value as any).groupId) {
        return value;
      }
    }
    for (const value of Object.values(node)) {
      const found = search(value);
      if (found) return found;
    }
    return null;
  };

  const detail = search(loaderData);
  if (detail) return detail;

  return (function pick(node: any): any | null {
    if (!node || typeof node !== 'object') return null;
    if (String(node.groupId || '') === postId && (node.imageList || node.video)) return node;
    for (const value of Object.values(node)) {
      const found = pick(value);
      if (found) return found;
    }
    return null;
  })(loaderData);
}

async function extractLemon8(rawUrl: string) {
  const target = parseLemon8Url(rawUrl);
  if (!target) {
    throw new Lemon8Error(
      'That is not a Lemon8 post link. Paste a link such as https://www.lemon8-app.com/@name/7012345678901234567?region=us',
      400
    );
  }

  const html = await fetchPageHtml(target.pageUrl);
  const state = readRemixState(html);
  if (!state) {
    throw new Lemon8Error(
      'Lemon8 did not include the post data in that page. The post may be private or removed, or the page layout changed.',
      502
    );
  }

  const detail = findPostDetail(state, target.postId);
  if (!detail) {
    throw new Lemon8Error(
      'Lemon8 returned that page without its media. The post may be private, deleted, or only visible in the app.',
      404
    );
  }

  const postId = String(detail.groupId || target.postId);
  const handle = String(detail.author?.linkName || target.handle || '').replace(/^@/, '');
  const authorName = String(detail.author?.nickName || handle || 'Lemon8 creator');
  const title = String(detail.title || detail.shortContent || '').trim().slice(0, 400) || `Lemon8 post ${postId}`;
  const content = String(detail.content || '').trim().slice(0, 2000);
  const pageUrl = `${LEMON8_ORIGIN}/@${handle || 'post'}/${postId}`;
  const base = `lemon8_${postId}_${(handle || 'lemon8').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30) || 'lemon8'}`;

  const media: any[] = [];

  if (detail.video && detail.video.url) {
    const videoUrl = String(detail.video.url);
    media.push({
      type: 'video',
      url: videoUrl,
      downloadUrl: proxied(videoUrl, `${base}_video.${extensionFor(videoUrl, 'video')}`),
      filename: `${base}_video.mp4`,
      width: Number(detail.video.width) || 0,
      height: Number(detail.video.height) || 0,
      duration: formatDuration(detail.video.duration),
    });
  }

  const images: any[] = Array.isArray(detail.imageList) ? detail.imageList : [];
  images.forEach((image: any, index: number) => {
    const url = String(image?.url || '').trim();
    if (!url) return;
    const ext = extensionFor(url, 'image');
    media.push({
      type: 'image',
      url,
      downloadUrl: proxied(url, `${base}_image_${index + 1}.${ext}`),
      filename: `${base}_image_${index + 1}.${ext}`,
      width: Number(image.width) || 0,
      height: Number(image.height) || 0,
      duration: '',
    });
  });

  if (media.length === 0) {
    throw new Lemon8Error(
      'That Lemon8 post has no public image or video in its page data, so there is nothing to save.',
      404
    );
  }

  const coverSource = String(
    detail.video?.cover || detail.largeImage?.url || detail.imageList?.[0]?.url || ''
  ).trim();
  const published = Number(detail.publishTime) || 0;
  const isVideo = media[0].type === 'video';

  return {
    kind: isVideo ? 'video' : 'gallery',
    id: postId,
    title,
    content,
    pageUrl,
    author: {
      handle,
      name: authorName,
      avatar: String(detail.author?.avatar || ''),
      followers: formatCount(detail.author?.followerCount),
    },
    cover: coverSource ? proxied(coverSource, `${base}_cover.${extensionFor(coverSource, 'image')}`) : '',
    coverDownload: coverSource
      ? proxied(coverSource, `${base}_cover.${extensionFor(coverSource, 'image')}`)
      : '',
    media,
    stats: {
      likes: formatCount(detail.diggCount),
      saves: formatCount(detail.favoriteCount),
      comments: formatCount(detail.commentCount),
      views: formatCount(detail.readCount),
    },
    publishedAt: published ? new Date(published * 1000).toISOString() : '',
    note: isVideo
      ? 'This is the MP4 Lemon8 itself serves for the post. The signed CDN link expires, so download now; nothing is re-encoded or watermarked here.'
      : 'These are the post’s own gallery images at the size Lemon8 serves. The signed CDN links expire, so save them now.',
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
        'Paste a public Lemon8 post link, for example https://www.lemon8-app.com/@name/7012345678901234567?region=us',
    });
  }
  if (rawUrl.length > 2048) {
    return res.status(414).json({ error: 'URL is too long.' });
  }

  try {
    const result = await extractLemon8(rawUrl);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Lemon8Error) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Lemon8 extraction error:', error);
    return res
      .status(502)
      .json({ error: 'Could not read that Lemon8 post. Please check the link and try again.' });
  }
}
