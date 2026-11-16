// Lemon8 post extractor (lemon8-app.com).
//
// Lemon8 is a ByteDance app, and its public web pages are a Remix app: the
// server renders the post's own data into
//
//   <script type="application/json" data-ttark="__remixContext">…</script>
//
// as a URL-encoded JSON blob. That blob already carries the gallery image
// URLs and, for a video post, the direct MP4 on tiktokcdn — exactly the media
// yt-dlp-style tools end up downloading, without any token, cookie or API key.
// This module parses that payload; it never scrapes rendered HTML.
//
// No dependencies: the Cloudflare Pages bundler and server.ts both import it,
// and both pass their own `fetch` (Workers runtime / Node's undici).

export const LEMON8_HOSTS = ['lemon8-app.com', 'www.lemon8-app.com', 'm.lemon8-app.com'] as const;
export const LEMON8_ORIGIN = 'https://www.lemon8-app.com';
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_TEXT = 400;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class Lemon8Error extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'Lemon8Error';
    this.status = status;
  }
}

export interface Lemon8Target {
  pageUrl: string;
  postId: string;
  handle: string;
}

export interface Lemon8Media {
  type: 'video' | 'image';
  /** Direct CDN address (signed, short-lived). */
  url: string;
  /** /api/proxy-media url that saves the file under `filename`. */
  downloadUrl: string;
  filename: string;
  width: number;
  height: number;
  duration: string;
}

export interface Lemon8Result {
  kind: 'video' | 'gallery';
  id: string;
  title: string;
  content: string;
  pageUrl: string;
  author: { handle: string; name: string; avatar: string; followers: string };
  cover: string;
  coverDownload: string;
  media: Lemon8Media[];
  stats: { likes: string; saves: string; comments: string; views: string };
  publishedAt: string;
  note: string;
}

/** Accepts /@user/<id>, a bare post id, and share links with ?post_id=. */
export function parseLemon8Url(rawInput: string): Lemon8Target | null {
  const input = (rawInput || '').trim();
  if (!input) return null;

  if (/^\d{15,25}$/.test(input)) {
    return { postId: input, handle: '', pageUrl: `${LEMON8_ORIGIN}/` };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
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

  // /@handle/<postId>
  const match = parsed.pathname.match(/^\/@([\w.\-]{1,60})\/(\d{15,25})\/?$/);
  if (match) {
    const handle = match[1];
    const postId = match[2];
    const region = params.get('region');
    const pageUrl = `${LEMON8_ORIGIN}/@${handle}/${postId}${region ? `?region=${encodeURIComponent(region)}` : ''}`;
    return { pageUrl, postId, handle };
  }

  // /@handle — a profile, which has no single set of media to hand over.
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
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const match = path.match(/\.(mp4|webm|mov|webp|jpe?g|png|avif)$/);
  if (match) return match[1] === 'jpeg' ? 'jpg' : match[1];
  return type === 'video' ? 'mp4' : 'jpg';
}

function safeHandle(handle: string): string {
  return (handle || 'lemon8').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30) || 'lemon8';
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
      throw new Lemon8Error(`Lemon8 returned HTTP ${response.status} for that post.`, response.status === 403 ? 403 : 502);
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

/** Pulls and decodes the Remix loader payload from the page HTML. */
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

/** Finds the post-detail object in the loader data, whatever the route id is. */
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

  // Fallback: any object carrying the requested groupId.
  const anyDetail = (function pick(node: any): any | null {
    if (!node || typeof node !== 'object') return null;
    if (String(node.groupId || '') === postId && (node.imageList || node.video)) return node;
    for (const value of Object.values(node)) {
      const found = pick(value);
      if (found) return found;
    }
    return null;
  })(loaderData);
  return anyDetail;
}

export async function extractLemon8(rawUrl: string): Promise<Lemon8Result> {
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
  const title = String(detail.title || detail.shortContent || '').trim().slice(0, MAX_TEXT) || `Lemon8 post ${postId}`;
  const content = String(detail.content || '').trim().slice(0, 2000);
  const pageUrl = `${LEMON8_ORIGIN}/@${handle || 'post'}/${postId}`;
  const base = `lemon8_${postId}_${safeHandle(handle)}`;

  const audio = detail.audio || detail.music || null;
  void audio;

  const media: Lemon8Media[] = [];

  if (detail.video && detail.video.url) {
    const videoUrl = String(detail.video.url);
    const width = Number(detail.video.width) || 0;
    const height = Number(detail.video.height) || 0;
    media.push({
      type: 'video',
      url: videoUrl,
      downloadUrl: proxied(videoUrl, `${base}_video.${extensionFor(videoUrl, 'video')}`),
      filename: `${base}_video.mp4`,
      width,
      height,
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
  const stats = {
    likes: formatCount(detail.diggCount),
    saves: formatCount(detail.favoriteCount),
    comments: formatCount(detail.commentCount),
    views: formatCount(detail.readCount),
  };

  return {
    kind: media[0].type === 'video' ? 'video' : 'gallery',
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
    stats,
    publishedAt: published ? new Date(published * 1000).toISOString() : '',
    note:
      media[0].type === 'video'
        ? 'This is the MP4 Lemon8 itself serves for the post. The signed CDN link expires, so download now; nothing is re-encoded or watermarked here.'
        : 'These are the post’s own gallery images at the size Lemon8 serves. The signed CDN links expire, so save them now.',
  };
}
