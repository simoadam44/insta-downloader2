import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { KickError, extractKick } from '../../lib/kickExtract';

// Public Kick clip / VOD extraction endpoint.
// Accepts GET ?url= and POST { url }.
//
// The work happens in lib/kickExtract.ts (shared with the Express server and
// mirrored in api/kick.ts for Vercel): a clip is resolved to its HLS playlist
// and re-assembled by /api/kick-clip; a VOD is reported with its real variant
// playlists because it is far too large to hand over as a single file here.
// No cookie, login or API key is involved.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'kick', 30, 60 * 1000)) {
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
          'Paste a public Kick clip or VOD link, for example https://kick.com/xqc?clip=clip_01H811MXG4FBR62FXPE1AXABDH',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractKick(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof KickError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json({ error: 'Could not read that Kick link. Please check it and try again.' }, 502, noCache);
  }
}
