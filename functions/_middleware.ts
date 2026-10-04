// Pages Functions middleware: exact-path SEO files + staging guard.
// 1. Serves /sitemap.xml and the Yandex verification file with HTTP 200 on
//    their EXACT URLs. (The _redirects 200-rewrites proved unreliable in this
//    project — the middleware demonstrably runs on every request, so exact
//    pathname matching here is bulletproof. No other path is affected.)
// 2. Keeps STAGING (any *.pages.dev host) out of search-engine indexes via
//    `X-Robots-Tag: noindex, nofollow`, while leaving production untouched.
// Bodies (including media streams) pass through intact.
import { buildSitemapResponse, resolveSeoOrigin, YANDEX_PATH, yandexResponse } from './_lib/seo-files';

interface MiddlewareContext {
  request: Request;
  env: Record<string, string | undefined>;
  next: () => Promise<Response>;
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);

  // Exact-path SEO files (GET only — everything else falls through).
  if (context.request.method === 'GET') {
    if (url.pathname === '/sitemap.xml') {
      return buildSitemapResponse(resolveSeoOrigin(url.hostname), context.env);
    }
    if (url.pathname === YANDEX_PATH) {
      return yandexResponse();
    }
  }

  const res = await context.next();
  try {
    const host = url.hostname.toLowerCase();
    if (host.endsWith('.pages.dev')) {
      const headers = new Headers(res.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    }
  } catch {
    // Never break a response because of the staging guard.
  }
  return res;
}
