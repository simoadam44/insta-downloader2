// Per-route <head> metadata sourced from the SAME database the React app uses
// (Supabase `site_settings.seo_overrides`, `keyword_pages`, `guide_articles`).
//
// This is not a second source of truth: it mirrors what the client-side SEO
// engine (src/services/seoEngine.ts) writes after hydration, so the first HTML
// response carries the correct canonical/title/description instead of the
// homepage's. If the database is unavailable the structural routes still get a
// correct canonical and the DB-backed pages simply fall back to the client
// (fail-open, never fail-closed).
import { TOOL_CONTENT } from '../../src/data/i18nData';
import { INFO_PAGES } from '../../src/data/infoPages';
import type { MediaType } from '../../src/types';
import { getSbConfig, sbList } from './supabase';
import {
  LANGUAGE_CODES,
  PageHeadMeta,
  PRODUCTION_ORIGIN,
  RouteInfo,
  ToolSlug,
  buildHreflangCluster,
  parseRoutePath,
} from './seoHtml';

const CACHE_TTL_MS = 15 * 60 * 1000;

const SLUG_TO_MEDIA_TYPE: Record<ToolSlug, MediaType> = {
  'video-downloader': 'video',
  'photo-downloader': 'photo',
  'reels-downloader': 'reels',
  'story-saver': 'story',
  'highlights-downloader': 'highlights',
};

// Evidence: the live rendered homepage metadata (same strings the client sets
// from the production seo_overrides). Used only as a fallback.
const HOME_META = {
  title: 'Instagram Video Downloader – Free HD MP4, No Watermark',
  description:
    'Download public Instagram videos, Reels and photos as MP4 in HD — free, no login, no watermark. Paste a link and save it to your phone or computer.',
};

// Mirrors updateBlogHubSeo()'s English output (it intentionally uses the
// default brand name, not branding.siteName).
const BLOG_HUB_META = {
  title: 'IGSaveGo Blog — Step-by-Step Instagram Download Guides',
  description:
    'Step-by-step Instagram video, reels, story and photo download guides in HD — no apps, no login.',
};

// Site-wide internal links injected into the crawlable block. The audit found
// 91% of the sitemap had no inbound link at all, so every page now links its
// tool siblings and the other platform pages in the first HTML response.
const TOOL_LINKS: { slug: ToolSlug; label: string }[] = [
  { slug: 'video-downloader', label: 'Instagram Video Downloader' },
  { slug: 'reels-downloader', label: 'Instagram Reels Downloader' },
  { slug: 'photo-downloader', label: 'Instagram Photo Downloader' },
  { slug: 'story-saver', label: 'Instagram Story Saver' },
  { slug: 'highlights-downloader', label: 'Instagram Highlights Downloader' },
];

const PLATFORM_LINKS: { href: string; label: string }[] = [
  { href: '/bluesky-downloader', label: 'Bluesky Downloader' },
  { href: '/linkedin-downloader', label: 'LinkedIn Video Downloader' },
  { href: '/pinterest-downloader', label: 'Pinterest Video Downloader' },
  { href: '/lemon8-downloader', label: 'Lemon8 Downloader' },
  { href: '/loom-downloader', label: 'Loom Video Downloader' },
  { href: '/twitter-downloader', label: 'X (Twitter) Downloader' },
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const para = (text: string): string => `<p style="margin:0 0 1rem">${escapeHtml(text)}</p>`;

/**
 * Real, visible page copy for the first HTML response.
 *
 * The app is client-rendered, so before this existed every URL shipped an empty
 * #root: Google had to re-render, and Bing/Yandex/AI crawlers saw nothing at all.
 * The block below is the page's own H1, intro and first sections — never hidden,
 * and never different from what the user sees after hydration.
 */
function linksBlock(lang: string): string {
  const items = [
    { href: '/', label: 'Instagram Video Downloader (home)' },
    ...TOOL_LINKS.map((tool) => ({ href: `/${lang}/${tool.slug}`, label: tool.label })),
    ...PLATFORM_LINKS,
    { href: '/blog', label: 'Download guides' },
    { href: '/how-to-use', label: 'How to use' },
    { href: '/faq', label: 'FAQ' },
  ];
  return (
    `<nav aria-label="More tools and guides" style="margin:1.5rem 0 0">` +
    `<h2 style="font-size:1.25rem;line-height:1.25;margin:0 0 1rem;font-weight:800">More tools and guides</h2>` +
    `<ul style="margin:0;padding-inline-start:1.25rem">` +
    items.map((item) => `<li><a href="${item.href}">${escapeHtml(item.label)}</a></li>`).join('') +
    `</ul></nav>`
  );
}

function buildCrawlHtml(route: RouteInfo): string {
  const heading = (level: 1 | 2, text: string) =>
    `<h${level} style="font-size:${level === 1 ? '1.9rem' : '1.25rem'};line-height:1.25;margin:0 0 1rem;font-weight:800">${escapeHtml(text)}</h${level}>`;

  if (route.kind === 'info') {
    const page = INFO_PAGES[route.infoId];
    const parts: string[] = [heading(1, page.h1)];
    for (const intro of page.intro.slice(0, 2)) parts.push(para(intro));

    const section = page.sections[0];
    if (section) {
      parts.push(heading(2, section.heading));
      for (const block of section.blocks.slice(0, 2)) {
        if ('text' in block) parts.push(para(block.text));
        else if ('items' in block) {
          parts.push(`<ul style="margin:0 0 1rem;padding-inline-start:1.25rem">${block.items
            .slice(0, 5)
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}</ul>`);
        }
      }
    }

    const faq = page.faqs?.[0];
    if (faq) {
      parts.push(heading(2, 'Questions and answers'));
      parts.push(`<p style="margin:0 0 .25rem"><strong>${escapeHtml(faq.question)}</strong></p>`);
      parts.push(para(faq.answer));
    }
    return parts.join('') + linksBlock('en');
  }

  if (route.kind !== 'home' && route.kind !== 'lang' && route.kind !== 'tool' && route.kind !== 'lang-tool') {
    return '';
  }

  const lang = route.kind === 'home' ? 'en' : route.lang;
  const mediaType: MediaType =
    route.kind === 'tool' || route.kind === 'lang-tool' ? SLUG_TO_MEDIA_TYPE[route.toolSlug] : 'video';
  const content = TOOL_CONTENT[mediaType]?.[lang as keyof (typeof TOOL_CONTENT)[MediaType]] || TOOL_CONTENT[mediaType]?.en;
  if (!content) return '';

  const parts: string[] = [heading(1, content.h1), para(content.subtitle)];
  if (content.steps?.length) {
    parts.push(`<ol style="margin:0 0 1rem;padding-inline-start:1.25rem">${content.steps
      .map((step) => `<li>${escapeHtml(step.title)} — ${escapeHtml(step.description)}</li>`)
      .join('')}</ol>`);
  }
  const features = content.features?.slice(0, 3) || [];
  if (features.length) {
    parts.push(`<ul style="margin:0 0 1rem;padding-inline-start:1.25rem">${features
      .map((f) => `<li><strong>${escapeHtml(f.title)}</strong> — ${escapeHtml(f.description)}</li>`)
      .join('')}</ul>`);
  }
  for (const faq of content.faqs?.slice(0, 2) || []) {
    parts.push(`<p style="margin:0 0 .25rem"><strong>${escapeHtml(faq.question)}</strong></p>`);
    parts.push(para(faq.answer));
  }
  return parts.join('') + linksBlock(lang);
}

interface SeoOverride {
  title: string;
  metaDescription: string;
}

interface ContentMeta {
  title: string;
  description: string;
  lang: string;
}

interface EdgeSeoData {
  siteName: string;
  overrides: Record<string, SeoOverride>;
  keywords: Map<string, ContentMeta>;
  guides: Map<string, ContentMeta>;
  /**
   * True only when the keyword and guide lists were fetched successfully.
   * Route resolution uses it to decide between "this slug is not published"
   * (404) and "the database is unreachable, fail open".
   */
  ready: boolean;
}

const EMPTY_DATA: EdgeSeoData = {
  siteName: 'IGSaveGo',
  overrides: {},
  keywords: new Map(),
  guides: new Map(),
  ready: false,
};

let cache: { data: EdgeSeoData; expires: number } | null = null;
let inFlight: Promise<EdgeSeoData> | null = null;

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().substring(0, max) : '';

function normalizeLang(value: unknown): string {
  const lang = str(value, 8).toLowerCase();
  return (LANGUAGE_CODES as readonly string[]).includes(lang) ? lang : 'en';
}

async function loadEdgeSeoData(env: Record<string, string | undefined>): Promise<EdgeSeoData> {
  if (cache && Date.now() < cache.expires) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cfg = getSbConfig(env);
    if (!cfg) return EMPTY_DATA;

    // allSettled, not all: a single failing table must not blank the whole
    // payload, and the per-table outcome is what makes "slug not found"
    // trustworthy (see `ready` below).
    const [settingsRes, keywordRes, guideRes] = await Promise.allSettled([
      sbList(cfg, 'site_settings', { select: 'branding,seo_overrides', eq: { id: 'global' } }),
      sbList(cfg, 'keyword_pages', { select: 'slug,title,meta_description,lang', eq: { enabled: true } }),
      sbList(cfg, 'guide_articles', { select: 'slug,title,meta_description,lang', eq: { enabled: true } }),
    ]);

    const rowsOf = (res: PromiseSettledResult<any[]>): any[] =>
      res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : [];

    const settingsRows = rowsOf(settingsRes);
    const keywordRows = rowsOf(keywordRes);
    const guideRows = rowsOf(guideRes);

    const data: EdgeSeoData = {
      siteName: 'IGSaveGo',
      overrides: {},
      keywords: new Map(),
      guides: new Map(),
      ready: keywordRes.status === 'fulfilled' && guideRes.status === 'fulfilled',
    };

    const settings = (settingsRows[0] as any) || {};
    const siteName = str(settings?.branding?.siteName, 80);
    if (siteName) data.siteName = siteName;

    const rawOverrides = settings?.seo_overrides;
    if (rawOverrides && typeof rawOverrides === 'object') {
      for (const [key, value] of Object.entries(rawOverrides)) {
        if (!value || typeof value !== 'object' || key.length > 80) continue;
        const item = value as any;
        const title = str(item.title, 200);
        const metaDescription = str(item.metaDescription, 400);
        if (title || metaDescription) data.overrides[key] = { title, metaDescription };
      }
    }

    for (const row of keywordRows) {
      const slug = str((row as any)?.slug, 160).toLowerCase();
      if (!slug) continue;
      data.keywords.set(slug, {
        title: str((row as any)?.title, 200),
        description: str((row as any)?.meta_description, 400),
        lang: normalizeLang((row as any)?.lang),
      });
    }

    for (const row of guideRows) {
      const slug = str((row as any)?.slug, 200).toLowerCase();
      if (!slug) continue;
      data.guides.set(slug, {
        title: str((row as any)?.title, 200),
        description: str((row as any)?.meta_description, 400),
        lang: normalizeLang((row as any)?.lang),
      });
    }

    return data;
  })()
    .catch(() => EMPTY_DATA)
    .then((data) => {
      cache = { data, expires: Date.now() + CACHE_TTL_MS };
      inFlight = null;
      return data;
    });

  return inFlight;
}

/**
 * Resolve canonical + title/description for a pathname.
 * Returns null only for routes where no safe canonical can be determined
 * (unknown paths, admin) or DB-backed pages whose slug is not published.
 */
export async function resolvePageHeadMeta(
  pathname: string,
  env: Record<string, string | undefined>,
  origin: string = PRODUCTION_ORIGIN
): Promise<PageHeadMeta | null> {
  const route = parseRoutePath(pathname);
  if (route.kind === 'unknown' || route.kind === 'admin') return null;

  const data = await loadEdgeSeoData(env);
  const canonicalUrl = `${origin}${route.path}`;
  const extras = () => ({
    alternates: buildHreflangCluster(route, origin),
    crawlHtml: buildCrawlHtml(route),
  });

  const withBrand = (value: string): string =>
    data.siteName !== 'IGSaveGo' ? value.replace(/IGSaveGo/gi, data.siteName) : value;

  const toolMeta = (mediaType: MediaType, lang: string) => {
    const override = data.overrides[`${mediaType}_${lang}`];
    const contentByLang = TOOL_CONTENT[mediaType] as Record<
      string,
      { title: string; metaDescription: string } | undefined
    >;
    const fallback = contentByLang?.[lang] || contentByLang?.['en'];
    // The client applies branding.siteName to BOTH override and default tool
    // metadata (updateDocumentSeo), so mirror that exactly.
    const rawTitle = override?.title || fallback?.title || '';
    const rawDescription = override?.metaDescription || fallback?.metaDescription || '';
    const title = rawTitle ? withBrand(rawTitle) : '';
    const description = rawDescription ? withBrand(rawDescription) : '';
    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  };

  if (route.kind === 'home') {
    const homeOverride = data.overrides['video_en'];
    return {
      canonicalUrl: `${origin}/`,
      title: withBrand(homeOverride?.title || HOME_META.title),
      description: withBrand(homeOverride?.metaDescription || HOME_META.description),
      ogType: 'website',
      lang: 'en',
      ...extras(),
    };
  }

  if (route.kind === 'lang') {
    return {
      canonicalUrl,
      ...toolMeta('video', route.lang),
      ogType: 'website',
      lang: route.lang,
      ...extras(),
    };
  }

  if (route.kind === 'tool' || route.kind === 'lang-tool') {
    return {
      canonicalUrl,
      ...toolMeta(SLUG_TO_MEDIA_TYPE[route.toolSlug], route.lang),
      ogType: 'website',
      lang: route.lang,
      ...extras(),
    };
  }

  if (route.kind === 'info') {
    const page = INFO_PAGES[route.infoId];
    // Titles/descriptions are authored for these pages and already contain the
    // brand; do not run them through withBrand() or they would read twice.
    return {
      canonicalUrl: `${origin}${page.path}`,
      title: page.title,
      description: page.description,
      ogType: 'website',
      lang: 'en',
      ...extras(),
    };
  }

  if (route.kind === 'blog-hub') {
    return {
      canonicalUrl: `${origin}/blog`,
      title: BLOG_HUB_META.title,
      description: BLOG_HUB_META.description,
      ogType: 'website',
      lang: 'en',
    };
  }

  if (route.kind === 'blog-article') {
    const guide = data.guides.get(route.slug.toLowerCase());
    if (!guide) return null;
    return {
      canonicalUrl,
      ...(guide.title ? { title: guide.title } : {}),
      ...(guide.description ? { description: guide.description } : {}),
      ogType: 'article',
      lang: guide.lang,
    };
  }

  // Single-segment keyword landing page. Only self-canonicalize when the slug
  // is actually published, so junk URLs don't claim a canonical.
  const keyword = data.keywords.get(route.slug.toLowerCase());
  if (!keyword) return null;
  return {
    canonicalUrl,
    ...(keyword.title ? { title: keyword.title } : {}),
    ...(keyword.description ? { description: keyword.description } : {}),
    ogType: 'website',
    lang: keyword.lang,
  };
}

export type RouteOutcome =
  | { status: 'ok'; meta: PageHeadMeta }
  | { status: 'not-found' }
  /** Consolidated route: answer with a permanent redirect instead of a page. */
  | { status: 'redirect'; to: string }
  /** Route exists but must be served as-is (admin, or a DB-backed page while
   *  the database is unreachable). */
  | { status: 'passthrough' };

/**
 * Decide what a pathname is *before* any HTML is sent.
 *
 * This is what turns the old soft-404 generator into real 404s:
 * - structurally impossible paths (/a/b/c/d) -> 404, no database needed
 * - a keyword/guide slug that is not published -> 404, but ONLY when the
 *   content tables answered. During a Supabase outage `ready` is false and
 *   every DB-backed page fails open exactly as before, so an outage can never
 *   turn live pages into 404s (which would deindex them).
 */
export async function resolveRouteOutcome(
  pathname: string,
  env: Record<string, string | undefined>,
  origin: string = PRODUCTION_ORIGIN
): Promise<RouteOutcome> {
  const route = parseRoutePath(pathname);
  if (route.kind === 'admin') return { status: 'passthrough' };
  if (route.kind === 'unknown') return { status: 'not-found' };

  // Single-segment keyword landing pages are consolidated onto the homepage.
  // They rendered the same tool with a different H1 for ~64 slugs (English,
  // Spanish, Arabic…), which is the scaled-content/doorway pattern Google's
  // September 2026 spam update targets; keeping them live kept the site in it.
  // A 301 preserves every inbound link and passes its signal to the real page.
  if (route.kind === 'keyword-candidate') return { status: 'redirect', to: '/' };

  const meta = await resolvePageHeadMeta(pathname, env, origin);
  if (meta) return { status: 'ok', meta };

  if (route.kind === 'blog-article') {
    const data = await loadEdgeSeoData(env);
    if (data.ready) return { status: 'not-found' };
  }

  return { status: 'passthrough' };
}
