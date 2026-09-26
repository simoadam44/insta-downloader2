import { ExtractedMedia, MediaType } from '../types';

// Sample verified Instagram URLs for quick testing
export const DEMO_URLS: { type: MediaType; label: string; url: string }[] = [
  {
    type: 'reels',
    label: 'Instagram Reel',
    url: 'https://www.instagram.com/p/DdeAp1xSZaR/',
  },
  {
    type: 'video',
    label: 'Viral Reel / Video',
    url: 'https://www.instagram.com/p/DYCNJV0NirM/',
  },
  {
    type: 'photo',
    label: 'Photo Post',
    url: 'https://www.instagram.com/p/DdKqjHYx-KR/',
  },
];

export function detectInstagramUrlType(inputUrl: string): { isValid: boolean; detectedType?: MediaType; cleanUrl?: string; error?: string } {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter an Instagram URL.' };
  }

  // Check if it looks like an Instagram URL or username
  const isInstagramDomain = /instagram\.com|instagr\.am/i.test(trimmed);

  if (!isInstagramDomain && !trimmed.startsWith('http')) {
    // Might be a username for story or highlight
    if (/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      return {
        isValid: true,
        detectedType: 'story',
        cleanUrl: `https://www.instagram.com/stories/${trimmed}/`,
      };
    }
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const pathname = parsed.pathname;

    if (/^\/share\/(?:p|r|reel|reels)\//i.test(pathname) || /^\/reel(s)?\//i.test(pathname)) {
      return { isValid: true, detectedType: 'reels', cleanUrl: trimmed };
    }
    if (/^\/p\//i.test(pathname) || /^\/share\/p\//i.test(pathname)) {
      return { isValid: true, detectedType: 'video', cleanUrl: trimmed };
    }
    if (/^\/stories\/highlights\//i.test(pathname) || /^\/s\//i.test(pathname)) {
      return { isValid: true, detectedType: 'highlights', cleanUrl: trimmed };
    }
    if (/^\/stories\//i.test(pathname)) {
      return { isValid: true, detectedType: 'story', cleanUrl: trimmed };
    }
    if (/^\/tv\//i.test(pathname)) {
      return { isValid: true, detectedType: 'video', cleanUrl: trimmed };
    }

    // Generic Instagram post or share link
    if (isInstagramDomain) {
      return { isValid: true, detectedType: 'video', cleanUrl: trimmed };
    }

    return { isValid: false, error: 'Invalid link. Please provide a valid Instagram post, reel, story, or highlight URL.' };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL (e.g. https://www.instagram.com/p/...)' };
  }
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

// Extract media using real backend Instagram extraction
export async function extractInstagramMedia(rawUrl: string, requestedType?: MediaType): Promise<ExtractedMedia> {
  const trimmed = rawUrl.trim();
  const detection = detectInstagramUrlType(trimmed);

  if (!detection.isValid) {
    throw new Error(detection.error || 'Please enter a valid Instagram URL.');
  }

  const apiBase = getApiBaseUrl();
  const targetEndpoint = `${apiBase}/api/extract?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;

  let response: Response | null = null;
  let lastError: any = null;

  // Try up to 2 times to absorb any transient network jitter
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetch(targetEndpoint, {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (response.ok) {
        break;
      }
    } catch (e) {
      lastError = e;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  if (!response || !response.ok) {
    const contentType = response?.headers.get('content-type') || '';
    const errorJson = response && contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    if (errorJson?.error) {
      throw new Error(errorJson.error);
    }
    if (response?.status === 404 && !contentType.includes('application/json')) {
      // Vercel serves its own HTML 404 page when /api/extract doesn't exist
      // (no serverless function deployed, or VITE_API_BASE_URL points nowhere).
      throw new Error(
        'Backend API not found (HTTP 404). The /api/extract function is not deployed. ' +
        'If the frontend is on Vercel, deploy the /api folder too — or set VITE_API_BASE_URL to your Cloud Run backend URL.'
      );
    }
    throw new Error(
      errorJson?.error ||
        (lastError ? lastError.message : `Failed to extract media (HTTP ${response?.status || '500'})`)
    );
  }

  const liveData = (await response.json()) as ExtractedMedia;
  if (!liveData || !liveData.items || liveData.items.length === 0) {
    throw new Error('Unable to extract playable media stream from this Instagram post.');
  }

  liveData.items = liveData.items.map((item) => {
    const fixedDownloadUrl = item.downloadUrl.startsWith('/api/') && apiBase ? `${apiBase}${item.downloadUrl}` : item.downloadUrl;
    return {
      ...item,
      downloadUrl: fixedDownloadUrl,
    };
  });

  if (requestedType && requestedType !== 'highlights') {
    liveData.mediaType = requestedType;
  }

  return liveData;
}

// Helper to trigger direct client download
export async function triggerBrowserDownload(fileUrl: string, filename: string): Promise<void> {
  try {
    const response = await fetch(fileUrl, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }
  } catch {
    // If CORS prevents direct blob creation, fallback to direct target download link
  }

  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

