import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { BlueskyError, extractBlueskyPost } from '../../lib/blueskyExtract';

// Public Bluesky (AT Protocol) extraction endpoint.
// Accepts GET ?url= and POST { url } and returns the same media descriptor the
// Instagram endpoint uses, so the result card can render both.
//
// The work happens in lib/blueskyExtract.ts (shared with the Express server):
// public AppView thread -> record blob CIDs -> com.atproto.sync.getBlob on the
// author's PDS. No key, no login, no cookies.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'bluesky', 30, 60 * 1000)) {
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
      { error: 'Paste a public Bluesky post link, for example https://bsky.app/profile/name.bsky.social/post/3kabc123xyz' },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractBlueskyPost(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof BlueskyError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json(
      { error: 'Could not read that Bluesky post. Please check the link and try again.' },
      502,
      noCache
    );
  }
}
