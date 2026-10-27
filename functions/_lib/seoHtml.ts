// Dependency-free helpers that put per-route SEO tags into the RAW HTML shell.//
// Why this exists: the site is a client-rendered SPA, so every URL used to be
// served the exact same <head> (homepage title + homepage canonical). That made
// every subpage look like a duplicate of the homepage to crawlers that read the
// first response. These helpers let the Cloudflare Pages middleware and the
// Express production handler rewrite the shell per route without touching the
// React app, the routes, or the downloader.
//
// Kept inside functions/_lib so Cloudflare's Pages Functions bundler never has
// to resolve imports from outside the functions directory.

export const PRODUCTION_ORIGIN = 'https://igsavego.com';

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

export interface PageHeadMeta {
  /** Absolute canonical URL. Omitted when the route is not a known public page. */
  canonicalUrl?: string;
  title?: string;
  description?: string;
  ogType?: 'website' | 'article';
  lang?: string;
}

export type RouteInfo =
  | { kind: 'home'; path: '/' }
  | { kind: 'admin'; path: string }
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
 * - Production (igsavego.com / www / previews / anything else) -> non-www.
 * - Local development keeps its own origin so local previews stay self-contained.
 */
export function resolveCanonicalOrigin(url: URL): string {
  const host = (url.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return url.origin;
  }
  return PRODUCTION_ORIGIN;
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

  return out;
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
