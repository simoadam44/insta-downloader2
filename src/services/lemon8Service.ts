import { ExtractedMedia, ExtractedMediaItem } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the Lemon8 video / photo downloader.
//
// The check below only decides whether the pasted text looks like a Lemon8 post
// link; the server (lib/lemon8Extract.ts) is the authority on what the post
// actually contains. A link the client accepts and the server rejects simply
// gets the server's message, which names the reason.

export function detectLemon8Url(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a public Lemon8 post link first.' };
  }

  if (/^\d{15,25}$/.test(trimmed)) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid Lemon8 post URL.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^m\./, 'www.');
  if (host !== 'www.lemon8-app.com' && host !== 'lemon8-app.com') {
    return {
      isValid: false,
      error:
        'Only lemon8-app.com post links are supported, for example https://www.lemon8-app.com/@name/7012345678901234567?region=us',
    };
  }

  if (/^\/@[\w.\-]{1,60}\/\d{15,25}\/?$/.test(parsed.pathname)) return { isValid: true };

  const param = parsed.searchParams.get('post_id') || parsed.searchParams.get('item_id') || '';
  if (/^\d{15,25}$/.test(param)) return { isValid: true };

  if (/^\/@[\w.\-]{1,60}\/?$/.test(parsed.pathname)) {
    return {
      isValid: false,
      error:
        'That is a Lemon8 profile link. Open the post itself and paste its link — it looks like https://www.lemon8-app.com/@name/7012345678901234567',
    };
  }

  return {
    isValid: false,
    error: 'That Lemon8 link is not a post. Open the post and copy its link, then paste it here.',
  };
}

interface Lemon8ApiMedia {
  type: 'video' | 'image';
  url: string;
  downloadUrl: string;
  filename: string;
  width: number;
  height: number;
  duration: string;
}

interface Lemon8ApiResult {
  kind: 'video' | 'gallery';
  id: string;
  title: string;
  content: string;
  pageUrl: string;
  author: { handle: string; name: string; avatar: string; followers: string };
  cover: string;
  coverDownload: string;
  media: Lemon8ApiMedia[];
  stats: { likes: string; saves: string; comments: string; views: string };
  publishedAt: string;
  note: string;
}

function formatOf(item: Lemon8ApiMedia): ExtractedMediaItem['format'] {
  const ext = (item.filename.split('.').pop() || '').toLowerCase();
  if (ext === 'mp4') return 'mp4';
  if (ext === 'png') return 'png';
  if (ext === 'webp' || ext === 'avif') return 'webp';
  return 'jpg';
}

/**
 * Calls /api/lemon8 and converts the post into the ExtractedMedia shape the
 * shared result card renders. One Lemon8 post is either a single video or a
 * gallery of images, so the card's carousel is reused for multi-image posts.
 */
export async function extractLemon8Media(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectLemon8Url(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Lemon8 post URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/lemon8?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the Lemon8 extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(payload?.error || `Lemon8 extraction failed (HTTP ${response.status}). Please try again.`);
  }

  const data = (await response.json()) as Lemon8ApiResult;
  if (!data || !Array.isArray(data.media) || data.media.length === 0) {
    throw new Error('This Lemon8 post returned no downloadable video or image.');
  }

  const fix = (url: string) => (url.startsWith('/api/') && apiBase ? `${apiBase}${url}` : url);
  const isVideo = data.kind === 'video';

  const items: ExtractedMediaItem[] = data.media.map((item, index) => {
    const format = formatOf(item);
    const dimensions = item.width && item.height ? `${item.width} × ${item.height}` : '';
    const downloadUrl = fix(item.downloadUrl);
    return {
      id: `${data.id}-${index + 1}`,
      type: item.type === 'video' ? 'video' : 'photo',
      url: fix(item.url),
      thumbnail: item.type === 'video' ? fix(data.cover) : fix(item.url),
      downloadUrl,
      quality: 'original',
      dimensions,
      fileSize: '',
      format,
      availableQualities: [
        {
          id: 'original',
          label: item.type === 'video' ? 'Original MP4' : `Image ${index + 1}`,
          quality: 'original',
          resolution: dimensions,
          fileSize: '',
          downloadUrl,
          format,
        },
      ],
    };
  });

  return {
    id: data.id,
    mediaType: isVideo ? 'video' : 'photo',
    originalUrl: data.pageUrl,
    author: {
      username: data.author.handle || 'lemon8',
      fullName: data.author.name || 'Lemon8 creator',
      avatar: data.author.avatar || '',
      isVerified: false,
      followers: data.author.followers || undefined,
    },
    caption: data.title || data.content.slice(0, 240),
    timestamp: data.publishedAt || '',
    likes: data.stats.likes,
    comments: data.stats.comments || undefined,
    views: data.stats.views || undefined,
    duration: data.media[0]?.duration || undefined,
    note: data.note,
    items,
  };
}
