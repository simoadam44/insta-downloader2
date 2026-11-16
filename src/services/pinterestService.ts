import { ExtractedMedia } from '../types';
import { getApiBaseUrl } from './extractorService';

// Client-side half of the Pinterest downloader.
//
// The check below only decides whether the pasted link *looks* like a Pinterest
// pin; the server (lib/pinterestExtract.ts) is the authority on what it can
// return. A link the client accepts and the server rejects simply gets the
// server's message, which names the reason.

/** A public video pin used by the "try an example" button. */
export const PINTEREST_DEMO_URL = 'https://www.pinterest.com/pin/664281013778109217/';

const PIN_PATH = /\/pin\/(?:[\w-]{1,120}--)?\d{6,25}(?:[/?#]|$)/i;

export function detectPinterestPinUrl(input: string): { isValid: boolean; error?: string } {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Paste a public Pinterest pin link first.' };
  }

  if (/^\d{6,25}$/.test(trimmed)) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { isValid: false, error: 'Please enter a valid Pinterest pin URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  const isPinterestDomain = /^(?:[a-z]{2,3}\.)?pinterest\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(
    host
  );
  if (host === 'pin.it' || host.endsWith('.pin.it')) {
    return /^\/[A-Za-z0-9]{3,40}\/?$/.test(parsed.pathname)
      ? { isValid: true }
      : { isValid: false, error: 'That pin.it link does not look complete. Copy it again from Pinterest.' };
  }

  if (!isPinterestDomain) {
    return {
      isValid: false,
      error: 'Only pinterest.com pin links are supported, for example https://www.pinterest.com/pin/664281013778109217/',
    };
  }

  if (!PIN_PATH.test(parsed.pathname)) {
    return {
      isValid: false,
      error:
        'That Pinterest link is not a pin. Profile, board and search pages cannot be downloaded — open the pin itself and copy its link.',
    };
  }

  return { isValid: true };
}

/**
 * Calls /api/pinterest and returns the same shape the shared result card
 * consumes. Same-origin /api/proxy-media download paths get the configured API
 * base prefixed (the identical rule the other services use).
 */
export async function extractPinterestMedia(rawUrl: string): Promise<ExtractedMedia> {
  const trimmed = (rawUrl || '').trim();
  const detection = detectPinterestPinUrl(trimmed);
  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Pinterest pin URL.');
  }

  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/pinterest?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

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
    throw new Error('Could not reach the Pinterest extractor. Check your connection and try again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(
      payload?.error || `Pinterest extraction failed (HTTP ${response.status}). Please try again.`
    );
  }

  const result = (await response.json()) as ExtractedMedia;
  if (!result || !Array.isArray(result.items) || result.items.length === 0) {
    throw new Error('This Pinterest pin returned no downloadable video or image.');
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
