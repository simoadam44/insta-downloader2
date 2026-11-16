import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { LinkedInError, extractLinkedInPost } from '../../lib/linkedinExtract';

// Public LinkedIn post extraction endpoint.
// Accepts GET ?url= and POST { url } and returns the same media descriptor the
// Instagram and Bluesky endpoints use, so the shared result card renders all
// three without changes.
//
// The work happens in lib/linkedinExtract.ts (shared with the Express server):
// the public guest view of a post (/feed/update/urn:li:...) carries schema.org
// JSON-LD plus the signed licdn.com CDN URLs, so no cookie, login or API key is
// involved. Posts behind the login wall are reported as errors instead of being
// promised.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'linkedin', 30, 60 * 1000)) {
    return json({ error: 'Too many requests. Please wait a minute.' }, 429, noCache);
  }

  let rawUrl = new URL(request.url).searchParams.get('url') || '';
  if (!rawUrl && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as any;
    rawUrl = (typeof body?.url === 'string' ? body.url : '').trim();
  } else {
    rawUrl = rawUrl.trim();
  }

  if (!rawUrl) {
    return json(
      {
        error:
          'Paste a public LinkedIn post link, for example https://www.linkedin.com/posts/name_slug-activity-1234567890123456789-abcd',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractLinkedInPost(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof LinkedInError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json(
      { error: 'Could not read that LinkedIn post. Please check the link and try again.' },
      502,
      noCache
    );
  }
}
