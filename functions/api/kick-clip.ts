import { CfContext, checkRateLimit } from '../_lib/cf';
import { KickError, buildClipStream, loadClipPlaylist } from '../../lib/kickExtract';

// Streams one Kick clip as a single downloadable MPEG-TS file.
//
// Kick stores clips as a few .ts objects and its playlist addresses slices
// inside them with #EXT-X-BYTERANGE, so the segments are requested with Range
// headers and written to the response in order. Nothing is re-encoded, nothing
// is buffered in memory: each segment's chunks go straight to the client.
//
// Only the clip id is accepted from the caller, and it is validated before any
// request leaves the server, so this route can never fetch an arbitrary host.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }
  if (checkRateLimit(request, 'kickStream', 20, 60 * 1000)) {
    return new Response('Rate limit exceeded. Please wait a minute.', { status: 429 });
  }

  const clipId = (new URL(request.url).searchParams.get('id') || '').trim();
  if (!/^clip_[A-Za-z0-9]{8,64}$/.test(clipId)) {
    return new Response('A valid Kick clip id is required.', { status: 400 });
  }

  try {
    const { playlist, filename } = await loadClipPlaylist(clipId);
    const headers: Record<string, string> = {
      'Content-Type': 'video/mp2t',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (playlist.bytes > 0) headers['Content-Length'] = String(playlist.bytes);

    return new Response(buildClipStream(playlist.segments), { status: 200, headers });
  } catch (error) {
    const message =
      error instanceof KickError
        ? error.message
        : 'Could not read that Kick clip. Please try again in a minute.';
    const status = error instanceof KickError ? error.status : 502;
    return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
