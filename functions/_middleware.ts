// Pages Functions middleware: per-route SEO tags + exact-path SEO files + guards.
//
// 1. Serves /sitemap.xml and the Yandex verification file with HTTP 200 on
//    their EXACT URLs (the _redirects 200-rewrites proved unreliable here).
// 2. Rewrites the SPA shell's <head> per route so the FIRST response carries
//    the correct canonical / og:url / title / description — not the homepage's.
//    A client-rendered app otherwise serves identical metadata on every URL.
// 3. Keeps STAGING (*.pages.dev) and /admin out of search indexes via
//    `X-Robots-Tag: noindex, nofollow`.
// Bodies (including media streams and JSON APIs) pass through untouched.
import { resolvePageHeadMeta } from './_lib/pageMeta';
import { buildSitemapResponse, resolveSeoOrigin, YANDEX_PATH, yandexResponse } from './_lib/seo-files';
import {
  injectSeoHead,
  isRewritableHtml,
  prepareRewrittenHeaders,
  resolveCanonicalOrigin,
} from './_lib/seoHtml';

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
    const isAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    const isStaging = url.hostname.toLowerCase().endsWith('.pages.dev');
    const headers = new Headers(res.headers);

    if (isAdmin || isStaging) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // Admin is never rewritten (no canonical should point at it) and non-HTML
    // responses are never read, so media/API bodies stay byte-identical.
    if (isAdmin || !isRewritableHtml(res, context.request.method)) {
      if (headers.get('X-Robots-Tag')) {
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      }
      return res;
    }

    const meta = await resolvePageHeadMeta(url.pathname, context.env, resolveCanonicalOrigin(url));
    if (!meta) {
      if (headers.get('X-Robots-Tag')) {
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      }
      return res;
    }

    const html = await res.text();
    return new Response(injectSeoHead(html, meta), {
      status: res.status,
      statusText: res.statusText,
      headers: prepareRewrittenHeaders(headers),
    });
  } catch {
    // Never break a response because of SEO enrichment.
    return res;
  }
}
