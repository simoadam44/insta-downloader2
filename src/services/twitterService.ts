import { ExtractedMedia } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the X (formerly Twitter) downloader.
//
// The check below only decides whether the pasted link *looks* like an X post;
// the server (lib/twitterExtract.ts) is the authority on what it can return. A
// link the client accepts and the server rejects simply gets the server's
// message, which names the reason.

/** A public NASA post with four photos, used by the "try an example" button. */
export const TWITTER_DEMO_URL = 'https://x.com/NASA/status/2051361508181856362';

const STATUS_PATH = /\/status(?:es)?\/(\d{15,25})(?:[/?#]|$)/i;
const ID_ONLY = /^\d{15,25}$/;

export function detectTwitterPostUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a public X (Twitter) post link first.' };
  }

  if (ID_ONLY.test(trimmed)) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid X or Twitter post URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  const isTwitterHost =
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host === 'twitter.com' ||
    host.endsWith('.twitter.com');
  if (!isTwitterHost) {
    return {
      isValid: false,
      error:
        'Only x.com and twitter.com post links are supported, for example https://x.com/NASA/status/2051361508181856362',
    };
  }

  if (!STATUS_PATH.test(parsed.pathname)) {
    return {
      isValid: false,
      error:
        'That link is not a single post. Profiles, searches and hashtags cannot be downloaded — open the post that holds the video or photo and copy its link.',
    };
  }

  return { isValid: true };
}

/**
 * Calls /api/twitter and returns the same shape the shared result card
 * consumes. Same-origin /api/proxy-media download paths get the configured API
 * base prefixed (the identical rule the other services use).
 */
export async function extractTwitterMedia(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectTwitterPostUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid X or Twitter post URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/twitter?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the X extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(
      payload?.error || `X extraction failed (HTTP ${response.status}). Please try again.`
    );
  }

  const result = (await response.json()) as ExtractedMedia;
  if (!result || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error('This X post returned no downloadable video or image.');
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
