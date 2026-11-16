import { ExtractedMedia } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the LinkedIn downloader.
//
// The check below only decides whether the pasted link *looks* like a LinkedIn
// post link; the server (lib/linkedinExtract.ts) is the authority on what it can
// return. A link the client accepts and the server rejects simply gets the
// server's message, which names the reason.

/** Post permalink shapes LinkedIn actually hands out. */
const URN_PATTERN = /urn(?::|%3A)li(?::|%3A)(activity|share|ugcpost)(?::|%3A)\d{15,25}/i;
const SLUG_PATTERN = /-(activity|share|ugcpost)-\d{15,25}(?:[-/]|$)/i;

export function detectLinkedInPostUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a public LinkedIn post link first.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid LinkedIn post URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'linkedin.com' && host !== 'www.linkedin.com' && host !== 'm.linkedin.com') {
    return {
      isValid: false,
      error: 'Only linkedin.com post links are supported, for example https://www.linkedin.com/posts/name_slug-activity-1234567890123456789-abcd',
    };
  }

  let path = parsed.pathname + parsed.search;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the raw form; the patterns also accept %3A escapes.
  }

  if (!URN_PATTERN.test(path) && !SLUG_PATTERN.test(path)) {
    return {
      isValid: false,
      error:
        'That LinkedIn link is not a post. Open the post itself, choose "Copy link to post" in its menu, and paste that link.',
    };
  }

  return { isValid: true };
}

/**
 * Calls /api/linkedin and returns the same shape the shared result card
 * consumes. Same-origin /api/proxy-media download paths get the configured API
 * base prefixed (the identical rule the Instagram and Bluesky services use).
 */
export async function extractLinkedInMedia(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectLinkedInPostUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid LinkedIn post URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/linkedin?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the LinkedIn extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(
      payload?.error || `LinkedIn extraction failed (HTTP ${response.status}). Please try again.`
    );
  }

  const result = (await response.json()) as ExtractedMedia;
  if (!result || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error('This LinkedIn post returned no downloadable video or image.');
  }

  result.items = result.items.map((item) => {
    const fix = (url: string) => (url.startsWith('/api/') && apiBase ? `${apiBase}${url}` : url);
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
