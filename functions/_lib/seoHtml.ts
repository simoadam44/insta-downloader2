// Dependency-free helpers that put per-route SEO tags into the RAW HTML shell.
//
// Why this exists: the site is a client-rendered SPA, so every URL used to be
// served the exact same <head> (homepage title + homepage canonical). That made
// every subpage look like a duplicate of the homepage to crawlers that read the
// first response. These helpers let the Cloudflare Pages middleware and the
// Express production handler rewrite the shell per route without touching the
// React app, the routes, or the downloader.
//
// Kept inside functions/_lib; the only cross-directory import is the
// dependency-free shared page data module, which the Pages Functions bundler
// resolves at build time (verified with `wrangler pages functions build`).

import { INFO_PAGE_IDS, type InfoPageId } from '../../src/data/infoPages';

// Primary canonical host. The apex 301s here (see resolveCanonicalRedirect),
// so every canonical, og:url, sitemap and schema URL must use this origin.
export const PRODUCTION_ORIGIN = 'https://www.igsavego.com';
export const PRODUCTION_HOST = 'www.igsavego.com';
export const APEX_HOST = 'igsavego.com';

export const LANGUAGE_CODES = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const TOOL_SLUGS = [
  'video-downloader',
  'photo-downloader',
  'reels-downloader',
  'story-saver',
  'highlights-downloader',
] as const;
export type ToolSlug = (typeof TOOL_SLUGS)[number];

const RTL_LANGUAGES = ['ar'];

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

export interface PageHeadMeta {
  /** Absolute canonical URL. Omitted when the route is not a known public page. */
  canonicalUrl?: string;
  title?: string;
  description?: string;
  ogType?: 'website' | 'article';
  lang?: string;
  /** Self-referencing hreflang cluster, injected into the first HTML response. */
  alternates?: HreflangAlternate[];
  /**
   * Real page text (h1 + intro + a few sections) placed inside #root in the
   * first response, so crawlers that do not execute JavaScript still read the
   * page. React replaces it on mount, so it is never shown twice.
   */
  crawlHtml?: string;
}

export type RouteInfo =
  | { kind: 'home'; path: '/' }
  | { kind: 'admin'; path: string }
  | { kind: 'info'; infoId: InfoPageId; path: string }
  | { kind: 'lang'; lang: LanguageCode; path: string }
  | { kind: 'tool'; lang: LanguageCode; toolSlug: ToolSlug; path: string }
  | { kind: 'lang-tool'; lang: LanguageCode; toolSlug: ToolSlug; path: string }
  | { kind: 'blog-hub'; path: '/blog' }
  | { kind: 'blog-article'; slug: string; path: string }
  | { kind: 'keyword-candidate'; slug: string; path: string }
  | { kind: 'unknown'; path: string };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Canonical origin for the current request.
 * - Production (apex / www / previews / anything else) -> https://www.igsavego.com
 * - Local development keeps its own origin so local previews stay self-contained.
 */
export function resolveCanonicalOrigin(url: URL): string {
  const host = (url.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return url.origin;
  }
  return PRODUCTION_ORIGIN;
}

/**
 * Validated canonical origin used to build redirect targets.
 * An optional CANONICAL_ORIGIN / SITE_URL override is accepted ONLY when it is
 * an HTTPS igsavego.com URL; anything missing, malformed or foreign falls back
 * to the hard-coded production origin. A bad env value can therefore never
 * send traffic (or search engines) to another site.
 */
export function resolveCanonicalBase(env?: Record<string, string | undefined>): string {
  const configured = (env?.CANONICAL_ORIGIN || env?.SITE_URL || '').trim();
  if (!configured) return PRODUCTION_ORIGIN;
  try {
    const parsed = new URL(configured);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:' && (host === PRODUCTION_HOST || host === APEX_HOST)) {
      return PRODUCTION_ORIGIN;
    }
  } catch {
    /* fall through to the safe default */
  }
  return PRODUCTION_ORIGIN;
}

/**
 * Permanent canonical-host redirect (HTTP 301).
 *
 * - https://igsavego.com/*            -> https://www.igsavego.com/*  (path + query kept)
 * - http://www.igsavego.com/*         -> https://www.igsavego.com/*  (if the Worker sees HTTP)
 * - http://igsavego.com/*             -> https://www.igsavego.com/*  (single hop when Worker-visible)
 * - https://www.igsavego.com/*        -> untouched (no loop)
 * - previews, localhost, lookalikes   -> untouched
 * - /api/* and non-GET/HEAD           -> untouched (downloader/API safety)
 */
export function resolveCanonicalRedirect(
  url: URL,
  method: string,
  env?: Record<string, string | undefined>
): Response | null {
  if (method !== 'GET' && method !== 'HEAD') return null;

  const host = url.hostname.toLowerCase();
  const isApex = host === APEX_HOST;
  const isCanonicalWww = host === PRODUCTION_HOST;
  if (!isApex && !isCanonicalWww) return null;
  // Already on the canonical host over HTTPS: never redirect again.
  if (isCanonicalWww && url.protocol === 'https:') return null;

  // API traffic is host-agnostic: some clients do not follow 301s, and the
  // downloader must keep working on whichever host called it.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return null;

  // Assign pathname/search on a parsed URL instead of resolving a relative
  // string: a pathname beginning with "//" must never become a new host.
  const target = new URL(resolveCanonicalBase(env));
  target.pathname = url.pathname;
  target.search = url.search;

  return new Response(null, {
    status: 301,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/** Classify a URL pathname without touching the router or redirecting anything. */
export function parseRoutePath(pathname: string): RouteInfo {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { kind: 'home', path: '/' };

  const segments = clean.slice(1).split('/');
  const lower = segments.map((s) => s.toLowerCase());

  if (lower[0] === 'admin') return { kind: 'admin', path: clean };

  if (lower[0] === 'blog') {
    if (segments.length === 1) return { kind: 'blog-hub', path: '/blog' };
    if (segments.length === 2) {
      return { kind: 'blog-article', slug: safeDecode(segments[1]), path: `/blog/${segments[1]}` };
    }
    return { kind: 'unknown', path: clean };
  }

  if (segments.length === 1) {
    // Static informational/legal pages are resolved before the keyword engine
    // so a keyword page can never shadow /privacy, /terms, /faq, etc.
    const infoId = (INFO_PAGE_IDS as readonly string[]).includes(lower[0])
      ? (lower[0] as InfoPageId)
      : null;
    if (infoId) return { kind: 'info', infoId, path: `/${infoId}` };
    if ((LANGUAGE_CODES as readonly string[]).includes(lower[0])) {
      // The language root renders the video tool, so it consolidates there
      // (this is exactly what the client-side SEO code already does).
      return { kind: 'lang', lang: lower[0] as LanguageCode, path: `/${lower[0]}/video-downloader` };
    }
    if ((TOOL_SLUGS as readonly string[]).includes(lower[0])) {
      return { kind: 'tool', lang: 'en', toolSlug: lower[0] as ToolSlug, path: `/en/${lower[0]}` };
    }
    return { kind: 'keyword-candidate', slug: safeDecode(segments[0]), path: clean };
  }

  if (
    segments.length === 2 &&
    (LANGUAGE_CODES as readonly string[]).includes(lower[0]) &&
    (TOOL_SLUGS as readonly string[]).includes(lower[1])
  ) {
    return {
      kind: 'lang-tool',
      lang: lower[0] as LanguageCode,
      toolSlug: lower[1] as ToolSlug,
      path: `/${lower[0]}/${lower[1]}`,
    };
  }

  return { kind: 'unknown', path: clean };
}

export function languageDirection(lang: string | undefined): 'ltr' | 'rtl' {
  return lang && RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}

/**
 * hreflang cluster for a route. Only routes whose body is genuinely localized
 * are listed together; the homepage is the English default, so its x-default is
 * `/` (not `/en/video-downloader`, which contradicted its own canonical).
 */
export function buildHreflangCluster(route: RouteInfo, origin: string): HreflangAlternate[] {
  const abs = (path: string) => `${origin}${path}`;

  if (route.kind === 'home') {
    return [
      { hreflang: 'en', href: abs('/') },
      ...LANGUAGE_CODES.filter((l) => l !== 'en').map((l) => ({
        hreflang: l,
        href: abs(`/${l}/video-downloader`),
      })),
      { hreflang: 'x-default', href: abs('/') },
    ];
  }

  if (route.kind === 'lang') {
    return [
      ...LANGUAGE_CODES.map((l) => ({ hreflang: l, href: abs(`/${l}/video-downloader`) })),
      { hreflang: 'x-default', href: abs('/en/video-downloader') },
    ];
  }

  if (route.kind === 'tool' || route.kind === 'lang-tool') {
    return [
      ...LANGUAGE_CODES.map((l) => ({ hreflang: l, href: abs(`/${l}/${route.toolSlug}`) })),
      { hreflang: 'x-default', href: abs(`/en/${route.toolSlug}`) },
    ];
  }

  if (route.kind === 'info') {
    return [
      { hreflang: 'en', href: abs(route.path) },
      { hreflang: 'x-default', href: abs(route.path) },
    ];
  }

  return [];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const pattern = new RegExp(`<meta[^>]*\\b${attr}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n  </head>`);
}

/**
 * Rewrite the SPA shell's <head> in place: one canonical, matching og:url and
 * matching title/description, plus the correct html lang/dir. Idempotent.
 */
export function injectSeoHead(html: string, meta: PageHeadMeta): string {
  let out = html;

  if (meta.lang) {
    const dir = languageDirection(meta.lang);
    out = out.replace(/<html\b[^>]*>/i, `<html lang="${escapeAttr(meta.lang)}" dir="${dir}">`);
  }

  if (meta.title) {
    const tag = `<title>${escapeText(meta.title)}</title>`;
    out = /<title>[\s\S]*?<\/title>/i.test(out) ? out.replace(/<title>[\s\S]*?<\/title>/i, tag) : out.replace(/<\/head>/i, `  ${tag}\n  </head>`);
    out = upsertMeta(out, 'property', 'og:title', meta.title);
    out = upsertMeta(out, 'name', 'twitter:title', meta.title);
  }

  if (meta.description) {
    out = upsertMeta(out, 'name', 'description', meta.description);
    out = upsertMeta(out, 'property', 'og:description', meta.description);
    out = upsertMeta(out, 'name', 'twitter:description', meta.description);
  }

  if (meta.ogType) {
    out = upsertMeta(out, 'property', 'og:type', meta.ogType);
  }

  if (meta.canonicalUrl) {
    // Line-anchored so the explanatory comment in index.html (which mentions
    // <link rel="canonical"> inline) is never mistaken for the real tag.
    out = out.replace(/^[ \t]*<link[^>]*\brel=["']canonical["'][^>]*>[ \t]*\r?\n?/gim, '');
    out = out.replace(
      /<\/head>/i,
      `  <link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />\n  </head>`
    );
    out = upsertMeta(out, 'property', 'og:url', meta.canonicalUrl);
  }

  // hreflang belongs in the HTML, not only in the sitemap: crawlers that fetch
  // a page URL directly must see the cluster without running the client code.
  if (meta.alternates && meta.alternates.length > 0) {
    out = out.replace(/^[ \t]*<link[^>]*\brel=["']alternate["'][^>]*>[ \t]*\r?\n?/gim, '');
    const tags = meta.alternates
      .map((a) => `  <link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}" />`)
      .join('\n');
    out = out.replace(/<\/head>/i, `${tags}\n  </head>`);
  }

  if (meta.crawlHtml) {
    out = injectCrawlBody(out, meta.crawlHtml);
  }

  return out;
}

/**
 * Put the page's real text inside the empty SPA mount point.
 *
 * This is not cloaking and not hidden text: it is the same H1/intro/sections the
 * app renders, served for clients that never run JavaScript (Bing, Yandex, most
 * AI crawlers). `createRoot().render()` clears the container on mount, so a
 * human sees the app, never a duplicate copy.
 */
export function injectCrawlBody(html: string, blockHtml: string): string {
  if (!blockHtml.trim()) return html;
  const wrapped = `<div id="seo-prerender" style="max-width:60rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;line-height:1.7">${blockHtml}</div>`;
  if (/<div id="root">\s*<\/div>/i.test(html)) {
    return html.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${wrapped}</div>`);
  }
  // Fallback for a shell without the mount point (older builds, tests): the
  // block still goes into the document so the text is never lost.
  if (/<\/body>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${wrapped}`);
  }
  return html;
}

// ---------------------------------------------------------------------------
// Real 404 page
//
// Before this existed, every unknown path was answered by the SPA shell: HTTP
// 200, the homepage <title>, no canonical. Google treats those as soft 404s,
// so junk URLs looked like real pages and burned crawl budget.
//
// This page is plain HTML (no JS, no SPA): it is served with status 404 and
// `noindex, follow`, and it links to the pages a lost visitor actually wants,
// which also gives the crawler a way back into the site from a dead URL.
// ---------------------------------------------------------------------------

interface NotFoundCopy {
  lang: string;
  title: string;
  heading: string;
  body: string;
  home: string;
  guides: string;
  faq: string;
  contact: string;
  toolsHeading: string;
  tools: Array<{ href: string; label: string }>;
}

const NOT_FOUND_EN: NotFoundCopy = {
  lang: 'en',
  title: 'Page not found — IGSaveGo',
  heading: 'Page not found',
  body: 'The page you requested does not exist or has moved. Try one of the links below.',
  home: 'Instagram video downloader',
  guides: 'Download guides',
  faq: 'FAQ',
  contact: 'Contact us',
  toolsHeading: 'Other Instagram tools',
  tools: [
    { href: '/en/photo-downloader', label: 'Photo downloader' },
    { href: '/en/reels-downloader', label: 'Reels downloader' },
    { href: '/en/story-saver', label: 'Story saver' },
    { href: '/en/highlights-downloader', label: 'Highlights downloader' },
  ],
};

const NOT_FOUND_AR: NotFoundCopy = {
  lang: 'ar',
  title: 'الصفحة غير موجودة — IGSaveGo',
  heading: 'الصفحة غير موجودة',
  body: 'الصفحة التي طلبتها غير موجودة أو تم نقلها. جرّب أحد الروابط التالية.',
  home: 'تحميل فيديو من انستقرام',
  guides: 'أدلة التحميل',
  faq: 'الأسئلة الشائعة',
  contact: 'اتصل بنا',
  toolsHeading: 'أدوات انستقرام الأخرى',
  tools: [
    { href: '/ar/photo-downloader', label: 'تحميل صور انستقرام' },
    { href: '/ar/reels-downloader', label: 'تحميل ريلز انستقرام' },
    { href: '/ar/story-saver', label: 'حفظ ستوري انستقرام' },
    { href: '/ar/highlights-downloader', label: 'تحميل هايلايت انستقرام' },
  ],
};

/** Standalone 404 document. No script tags: it must render without JS. */
export function renderNotFoundHtml(lang: string = 'en'): string {
  const copy = lang === 'ar' ? NOT_FOUND_AR : NOT_FOUND_EN;
  const dir = languageDirection(copy.lang);
  const tools = copy.tools
    .map((tool) => `<li><a href="${tool.href}">${tool.label}</a></li>`)
    .join('');

  return [
    '<!doctype html>',
    `<html lang="${copy.lang}" dir="${dir}">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${copy.title}</title>`,
    '<meta name="robots" content="noindex, follow" />',
    '<style>',
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#f8fafc;color:#0f172a}',
    'main{max-width:34rem;padding:2.5rem 1.5rem;text-align:center}',
    'h1{font-size:2rem;margin:0 0 .75rem}',
    'p{color:#475569;line-height:1.6;margin:0 0 1.5rem}',
    'ul{list-style:none;padding:0;margin:0 0 1.5rem;display:grid;gap:.5rem}',
    'a{color:#e11d48;text-decoration:none;font-weight:600}',
    'a:hover{text-decoration:underline}',
    '.primary{display:inline-block;margin-bottom:1.5rem;padding:.75rem 1.5rem;border-radius:.75rem;',
    'background:#e11d48;color:#fff}',
    '.primary:hover{background:#be123c;text-decoration:none}',
    '.muted{font-size:.8rem;color:#94a3b8;margin-top:1.5rem}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<p class="muted">404</p>`,
    `<h1>${copy.heading}</h1>`,
    `<p>${copy.body}</p>`,
    `<a class="primary" href="/">${copy.home}</a>`,
    `<h2 style="font-size:.9rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b">${copy.toolsHeading}</h2>`,
    `<ul>${tools}</ul>`,
    `<p><a href="/blog">${copy.guides}</a> · <a href="/faq">${copy.faq}</a> · <a href="/contact">${copy.contact}</a></p>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

/** 404 response: real status, noindex+follow, never cached as a valid page. */
export function notFoundResponse(lang: string = 'en'): Response {
  return new Response(renderNotFoundHtml(lang), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

/** True when the response is an HTML document we are allowed to rewrite. */
export function isRewritableHtml(response: Response, method: string): boolean {
  if (method !== 'GET') return false;
  if (response.status !== 200) return false;
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('text/html')) return false;
  if (response.headers.get('content-disposition')) return false;
  return true;
}

/** Headers must lose body-specific values once the body has been rewritten. */
export function prepareRewrittenHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.delete('content-length');
  next.delete('content-encoding');
  next.delete('etag');
  return next;
}
