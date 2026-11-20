// Pages Functions middleware: canonical-host redirect + per-route SEO tags.
//
// 1. Sends the apex host to https://www.igsavego.com with a permanent 301
//    before any routing, asset or SEO work happens (GET/HEAD only, API and
//    non-GET/HEAD untouched).
// 2. Serves /sitemap.xml and the Yandex verification file with HTTP 200 on
//    their EXACT URLs (the _redirects 200-rewrites proved unreliable here).
// 3. Rewrites the SPA shell's <head> per route so the FIRST response carries
//    the correct canonical / og:url / title / description — not the homepage's.
//    A client-rendered app otherwise serves identical metadata on every URL.
// 4. Keeps STAGING (*.pages.dev) and /admin out of search indexes via
//    `X-Robots-Tag: noindex, nofollow`.
// Bodies (including media streams and JSON APIs) pass through untouched.
import { resolveRouteOutcome } from './_lib/pageMeta';
import { buildSitemapResponse, resolveSeoOrigin, YANDEX_PATH, yandexResponse } from './_lib/seo-files';
import {
  injectSeoHead,
  isRewritableHtml,
  notFoundResponse,
  prepareRewrittenHeaders,
  resolveCanonicalOrigin,
  resolveCanonicalRedirect,
  LANGUAGE_CODES,
} from './_lib/seoHtml';

interface MiddlewareContext {
  request: Request;
  env: Record<string, string | undefined>;
  next: () => Promise<Response>;
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);

  // Canonical host wins over everything: apex -> https://www.igsavego.com.
  // Implemented before SEO files/routing so /sitemap.xml and static assets on
  // the apex cannot bypass it. Returns null on the canonical host and for
  // previews/localhost, so there is no loop.
  const canonicalRedirect = resolveCanonicalRedirect(url, context.request.method, context.env);
  if (canonicalRedirect) return canonicalRedirect;

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

    const outcome = await resolveRouteOutcome(url.pathname, context.env, resolveCanonicalOrigin(url));

    // Real 404: unknown paths and unpublished DB slugs stop here instead of
    // being answered with the SPA shell (HTTP 200 + homepage title), which is
    // exactly what produced the soft-404 pattern in Search Console.
    if (outcome.status === 'not-found') {
      const first = url.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
      const lang = (LANGUAGE_CODES as readonly string[]).includes(first) ? first : 'en';
      return notFoundResponse(lang);
    }

    // Consolidated URLs (keyword landing pages) answer with one permanent
    // redirect to the page that actually serves that intent.
    if (outcome.status === 'redirect') {
      return new Response(null, {
        status: 301,
        headers: {
          Location: `${resolveCanonicalOrigin(url)}${outcome.to}`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (outcome.status === 'passthrough') {
      if (headers.get('X-Robots-Tag')) {
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      }
      return res;
    }

    const html = await res.text();
    return new Response(injectSeoHead(html, outcome.meta), {
      status: res.status,
      statusText: res.statusText,
      headers: prepareRewrittenHeaders(headers),
    });
  } catch {
    // Never break a response because of SEO enrichment.
    return res;
  }
}
