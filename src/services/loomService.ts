import { ExtractedMedia } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the Loom video downloader.
//
// The check below only decides whether the pasted text looks like a Loom
// recording link; the server (lib/loomExtract.ts) is the authority on what the
// recording actually exposes. A link the client accepts and the server rejects
// simply gets the server's message, which names the reason.

const VIDEO_ID = '[0-9a-fA-F]{32}';

export function detectLoomUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a public Loom video link first.' };
  }

  if (new RegExp(`^${VIDEO_ID}$`).test(trimmed)) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid Loom video URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'loom.com' && host !== 'www.loom.com') {
    return {
      isValid: false,
      error:
        'Only loom.com recording links are supported, for example https://www.loom.com/share/44bff3b7cd784946a61686092a353f48',
    };
  }

  if (new RegExp(`^/(?:share|embed|s)/${VIDEO_ID}/?$`).test(parsed.pathname)) return { isValid: true };

  if (/^\/share\/folder\//.test(parsed.pathname)) {
    return {
      isValid: false,
      error:
        'That is a Loom folder link. Open the recording you want and paste its own link — it looks like https://www.loom.com/share/<32-character id>',
    };
  }

  return {
    isValid: false,
    error: 'That Loom link is not a recording. Open the video and copy its share link, then paste it here.',
  };
}

interface LoomApiMedia {
  type: 'video' | 'image';
  url: string;
  downloadUrl: string;
  filename: string;
  width: number;
  height: number;
  duration: string;
}

interface LoomApiResult {
  id: string;
  title: string;
  description: string;
  pageUrl: string;
  author: { name: string; handle: string; avatar: string };
  cover: string;
  coverDownload: string;
  media: LoomApiMedia[];
  duration: string;
  durationSeconds: number;
  dimensions: string;
  createdAt: string;
  note: string;
}

/**
 * Calls /api/loom and converts the recording into the ExtractedMedia shape the
 * shared result card renders. A Loom recording is always a single video, so the
 * card shows one MP4 button with the recording's real dimensions.
 */
export async function extractLoomMedia(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectLoomUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Loom video URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/loom?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the Loom extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(payload?.error || `Loom extraction failed (HTTP ${response.status}). Please try again.`);
  }

  const data = (await response.json()) as LoomApiResult;
  if (!data || !Array.isArray(data.media) || data.media.length === 0) {
    throw new Error('This Loom recording returned no downloadable video.');
  }

  const fix = (url: string) => (url.startsWith('/api/') && apiBase ? `${apiBase}${url}` : url);
  const video = data.media[0];
  const downloadUrl = fix(video.downloadUrl);

  return {
    id: data.id,
    mediaType: 'video',
    originalUrl: data.pageUrl,
    author: {
      username: data.author.name || 'loom',
      fullName: data.author.name || 'Loom creator',
      avatar: data.author.avatar || '',
      isVerified: false,
    },
    caption: data.title || data.description.slice(0, 240),
    timestamp: data.createdAt || '',
    likes: '',
    duration: data.duration || video.duration || undefined,
    note: data.note,
    items: [
      {
        id: data.id,
        type: 'video',
        url: video.url,
        thumbnail: fix(data.cover),
        downloadUrl,
        quality: 'original',
        dimensions: data.dimensions || '',
        fileSize: '',
        format: 'mp4',
        availableQualities: [
          {
            id: 'original',
            label: 'Original MP4',
            quality: 'original',
            resolution: data.dimensions || '',
            fileSize: '',
            downloadUrl,
            format: 'mp4',
          },
        ],
      },
    ],
  };
}
