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
  ToolSlug,
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
  title: 'Instagram Video Downloader – Save Reels & Videos in HD',
  description:
    'Download Instagram videos and Reels as MP4 in HD. Paste a public link and save it to your phone or computer in seconds.',
};

// Mirrors updateBlogHubSeo()'s English output (it intentionally uses the
// default brand name, not branding.siteName).
const BLOG_HUB_META = {
  title: 'IGSaveGo Blog — Step-by-Step Instagram Download Guides',
  description:
    'Step-by-step Instagram video, reels, story and photo download guides in HD — no apps, no login.',
};

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
}

const EMPTY_DATA: EdgeSeoData = { siteName: 'IGSaveGo', overrides: {}, keywords: new Map(), guides: new Map() };

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

    const [settingsRows, keywordRows, guideRows] = await Promise.all([
      sbList(cfg, 'site_settings', { select: 'branding,seo_overrides', eq: { id: 'global' } }).catch(() => []),
      sbList(cfg, 'keyword_pages', {
        select: 'slug,title,meta_description,lang',
        eq: { enabled: true },
      }).catch(() => []),
      sbList(cfg, 'guide_articles', {
        select: 'slug,title,meta_description,lang',
        eq: { enabled: true },
      }).catch(() => []),
    ]);

    const data: EdgeSeoData = { siteName: 'IGSaveGo', overrides: {}, keywords: new Map(), guides: new Map() };

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
      const slug = str((row as any)?.slug, 160);
      if (!slug) continue;
      data.keywords.set(slug, {
        title: str((row as any)?.title, 200),
        description: str((row as any)?.meta_description, 400),
        lang: normalizeLang((row as any)?.lang),
      });
    }

    for (const row of guideRows) {
      const slug = str((row as any)?.slug, 200);
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
    };
  }

  if (route.kind === 'lang') {
    return {
      canonicalUrl,
      ...toolMeta('video', route.lang),
      ogType: 'website',
      lang: route.lang,
    };
  }

  if (route.kind === 'tool' || route.kind === 'lang-tool') {
    return {
      canonicalUrl,
      ...toolMeta(SLUG_TO_MEDIA_TYPE[route.toolSlug], route.lang),
      ogType: 'website',
      lang: route.lang,
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
    const guide = data.guides.get(route.slug);
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
  const keyword = data.keywords.get(route.slug);
  if (!keyword) return null;
  return {
    canonicalUrl,
    ...(keyword.title ? { title: keyword.title } : {}),
    ...(keyword.description ? { description: keyword.description } : {}),
    ogType: 'website',
    lang: keyword.lang,
  };
}
