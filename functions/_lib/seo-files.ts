// Shared SEO file builders used by BOTH the /api/* function routes AND the
// middleware exact-path serving (/sitemap.xml, /yandex_*.html).
// Reason: _redirects 200-rewrites proved unreliable in this project, while the
// middleware demonstrably runs on every request (staging noindex header).
import { getSbConfig, sbList } from './supabase';
import { INFO_PAGE_SEO } from '../../src/data/infoPages';

// ---- sitemap ----
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { xml: string; expires: number; origin: string } | null = null;

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];
const FALLBACK_ORIGIN = 'https://www.igsavego.com';

// Date of the last real content change of the tool pages and the homepage.
// It is a constant on purpose: stamping every URL with "today" on each build
// is what made Google distrust this sitemap's <lastmod> entirely.
export const SITE_CONTENT_UPDATED = '2026-11-20';

export function resolveSeoOrigin(hostname: string): string {
  const raw = (hostname || '').toLowerCase();
  // Primary canonical host is www: the apex 301s to it, so a sitemap must
  // never advertise the redirecting apex host.
  if (raw === 'www.igsavego.com' || raw === 'igsavego.com') {
    return 'https://www.igsavego.com';
  }
  if (raw.endsWith('.pages.dev') || raw.startsWith('localhost')) {
    return `https://${raw}`;
  }
  return FALLBACK_ORIGIN;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function buildSitemapResponse(origin: string, env: Record<string, string | undefined>): Promise<Response> {
  if (cached && Date.now() < cached.expires && cached.origin === origin) {
    return new Response(cached.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Sitemap-Cache': 'HIT',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  }

  let guides: { slug: string; updatedAt?: string }[] = [];
  try {
    const cfg = getSbConfig(env);
    if (cfg) {
      const gd = await sbList(cfg, 'guide_articles', { select: 'slug,updated_at', eq: { enabled: true } });
      guides = gd
        .filter((r: any) => r.slug)
        .map((r: any) => ({ slug: String(r.slug), updatedAt: r.updated_at || undefined }));
    }
  } catch {}

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Google ignores <changefreq> and <priority>; both were also inflated here
  // ("daily", priority 1.0 on every URL), so they are gone.
  const urlNode = (loc: string, lastmod: string, alternates?: { hl: string; href: string }[]) => {
    let n = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n`;
    if (alternates) {
      for (const a of alternates) n += `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${esc(a.href)}"/>\n`;
    }
    n += `  </url>\n`;
    return n;
  };

  // The homepage is the English default, so its x-default is `/` — pointing it
  // at /en/video-downloader contradicted the homepage's own canonical.
  xml += urlNode(
    `${origin}/`,
    SITE_CONTENT_UPDATED,
    [
      { hl: 'en', href: `${origin}/` },
      ...LANGS.filter((l) => l !== 'en').map((l) => ({ hl: l, href: `${origin}/${l}/video-downloader` })),
      { hl: 'x-default', href: `${origin}/` },
    ]
  );

  for (const lang of LANGS) {
    for (const slug of TOOL_SLUGS) {
      const pageUrl = `${origin}/${lang}/${slug}`;
      xml += urlNode(
        pageUrl,
        SITE_CONTENT_UPDATED,
        [...LANGS.map((l) => ({ hl: l, href: `${origin}/${l}/${slug}` })), { hl: 'x-default', href: `${origin}/en/${slug}` }]
      );
    }
  }

  // Keyword landing pages are intentionally absent: /<slug> now 301s to the
  // homepage, so listing them would advertise redirects as content.
  xml += urlNode(`${origin}/blog`, SITE_CONTENT_UPDATED);
  for (const g of guides) {
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : SITE_CONTENT_UPDATED;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod);
  }

  for (const page of INFO_PAGE_SEO) {
    xml += urlNode(`${origin}${page.path}`, page.updated);
  }

  xml += `</urlset>`;
  cached = { xml, expires: Date.now() + CACHE_TTL_MS, origin };

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Sitemap-Cache': 'MISS',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}

// ---- Yandex ownership file (byte-identical to public/yandex_*.html) ----
export const YANDEX_PATH = '/yandex_4778040ed943270f.html';

const YANDEX_BODY = `<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body>Verification: 4778040ed943270f</body>
</html>
`;

export function yandexResponse(): Response {
  return new Response(YANDEX_BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
