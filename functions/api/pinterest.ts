import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { PinterestError, extractPinterestPin } from '../../lib/pinterestExtract';

// Public Pinterest pin extraction endpoint.
// Accepts GET ?url= and POST { url } and returns the same media descriptor the
// Instagram, Bluesky and LinkedIn endpoints use, so the shared result card
// renders all of them without changes.
//
// The work happens in lib/pinterestExtract.ts (shared with the Express server):
// the public pin page embeds the pin record, which carries the progressive MP4
// and the pin's own image. No cookie, login or API key is involved, and pins
// behind the login wall are reported as errors instead of being promised.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'pinterest', 30, 60 * 1000)) {
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
          'Paste a public Pinterest pin link, for example https://www.pinterest.com/pin/664281013778109217/',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractPinterestPin(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof PinterestError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json(
      { error: 'Could not read that Pinterest pin. Please check the link and try again.' },
      502,
      noCache
    );
  }
}
