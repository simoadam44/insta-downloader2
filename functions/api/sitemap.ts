import { CfContext } from '../_lib/cf';
import { buildSitemapResponse, resolveSeoOrigin } from '../_lib/seo-files';

// GET /api/sitemap (also served as /sitemap.xml via the middleware exact-path
// rule). Always-fresh XML (Supabase keywords + guides), in-memory cache.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }
  const origin = resolveSeoOrigin(new URL(request.url).hostname);
  return buildSitemapResponse(origin, env);
}
