import { ExtractedMedia } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the Bluesky downloader.
//
// The parsing here only decides whether the pasted link *looks* like a bsky.app
// post; the server (lib/blueskyExtract.ts) is the authority on what it can
// return. Keeping the check in sync by hand is acceptable because the regexes
// are the same shape, but a link the client accepts and the server rejects
// simply gets the server's error message.

/** A public post used by the "try an example" button. */
export const BLUESKY_DEMO_URL =
  'https://bsky.app/profile/damjef.bsky.social/post/3mzsgbnati22w';

export function detectBlueskyPostUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a Bluesky post link first.' };
  }

  if (/^at:\/\//i.test(trimmed)) {
    return /^at:\/\/[^/]+\/app\.bsky\.feed\.post\/[A-Za-z0-9._~-]+\/?$/i.test(trimmed)
      ? { isValid: true }
      : {
          isValid: false,
          error: 'That AT URI does not point to a post. Use at://…/app.bsky.feed.post/…',
        };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid Bluesky post URL.' };
  }

  if (parsed.hostname.toLowerCase() !== 'bsky.app' && parsed.hostname.toLowerCase() !== 'www.bsky.app') {
    return {
      isValid: false,
      error: 'Only bsky.app post links are supported, for example https://bsky.app/profile/name.bsky.social/post/3kabc123xyz',
    };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0].toLowerCase() !== 'profile' ||
    segments[2].toLowerCase() !== 'post'
  ) {
    return {
      isValid: false,
      error: 'That bsky.app link is not a post. Open the post itself and copy the link from the share menu.',
    };
  }

  return { isValid: true };
}

/**
 * Calls /api/bluesky and returns the same shape the Instagram result card
 * consumes. Download links that came back as same-origin /api/proxy-media
 * paths get the configured API base prefixed (same rule as the IG service).
 */
export async function extractBlueskyMedia(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectBlueskyPostUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Bluesky post URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/bluesky?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the Bluesky extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(
      payload?.error || `Bluesky extraction failed (HTTP ${response.status}). Please try again.`
    );
  }

  const result = (await response.json()) as ExtractedMedia;
  if (!result || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error('This Bluesky post returned no downloadable video or image.');
  }

  result.items = result.items.map((item) => {
    const fix = (url: string) =>
      url.startsWith('/api/') && apiBase ? `${apiBase}${url}` : url;
    return {
      ...item,
      downloadUrl: fix(item.downloadUrl),
      url: fix(item.url),
      thumbnail: fix(item.thumbnail),
      availableQualities: item.availableQualities?.map((quality) => ({
        ...quality,
        downloadUrl: fix(quality.downloadUrl),
      })),
    };
  });

  return result;
}
