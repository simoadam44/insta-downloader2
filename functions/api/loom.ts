import { CfContext, checkRateLimit, json } from '../_lib/cf';
import { LoomError, extractLoom } from '../../lib/loomExtract';

// Public Loom video extraction endpoint (Cloudflare Pages).
// Accepts GET ?url= and POST { url } and returns the media descriptor used by
// the other tools: the recording's signed MP4 plus its thumbnail.
//
// The work happens in lib/loomExtract.ts (shared with the Express server and
// the Vercel function): it makes the same two read-only GraphQL calls Loom's own
// share page makes, which is also what the open-source yt-dlp Loom extractor
// does. No cookie, login or API key is involved.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, noCache);
  }
  if (checkRateLimit(request, 'loom', 30, 60 * 1000)) {
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
          'Paste a public Loom video link, for example https://www.loom.com/share/44bff3b7cd784946a61686092a353f48',
      },
      400,
      noCache
    );
  }
  if (rawUrl.length > 2048) return json({ error: 'URL is too long.' }, 414, noCache);

  try {
    const result = await extractLoom(rawUrl);
    return json(result, 200, noCache);
  } catch (error) {
    if (error instanceof LoomError) {
      return json({ error: error.message }, error.status, noCache);
    }
    return json(
      { error: 'Could not read that Loom recording. Please check the link and try again.' },
      502,
      noCache
    );
  }
}
