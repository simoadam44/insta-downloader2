import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { TwitterError, extractTwitterPost } from '../../lib/twitterExtract';

// Public X (formerly Twitter) post extraction endpoint.
// Accepts GET ?url= and POST { url } and returns the same media descriptor the
// Instagram, Bluesky, LinkedIn, Pinterest, Lemon8 and Loom endpoints use, so the
// shared result card renders all of them without changes.
//
// The work happens in lib/twitterExtract.ts (shared with the Express server):
// the post is read from X's public embedded-tweet endpoint, which needs no
// cookie, login or API key, and the media is the file X publishes. Posts X will
// not render to a logged-out reader are reported as errors instead of being
// promised.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'twitter', 30, 60 * 1000)) {
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
          'Paste a public X post link, for example https://x.com/NASA/status/2051361508181856362',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractTwitterPost(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof TwitterError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json({ error: 'Could not read that X post. Please check the link and try again.' }, 502, noCache);
  }
}
