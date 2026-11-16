import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { Lemon8Error, extractLemon8 } from '../../lib/lemon8Extract';

// Public Lemon8 post extraction endpoint (Cloudflare Pages).
// Accepts GET ?url= and POST { url } and returns the media descriptor used by
// the other tools: the post's own MP4 for a video post, or every gallery image
// with its own download link.
//
// The work happens in lib/lemon8Extract.ts (shared with the Express server and
// the Vercel function): Lemon8's public post page embeds the media addresses in
// its Remix loader payload, so no cookie, login or API key is involved.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'lemon8', 30, 60 * 1000)) {
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
          'Paste a public Lemon8 post link, for example https://www.lemon8-app.com/@name/7012345678901234567?region=us',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractLemon8(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof Lemon8Error) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json(
      { error: 'Could not read that Lemon8 post. Please check the link and try again.' },
      502,
      noCache
    );
  }
}
