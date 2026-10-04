// Shared SEO file builders used by BOTH the /api/* function routes AND the
// middleware exact-path serving (/sitemap.xml, /yandex_*.html).
// Reason: _redirects 200-rewrites proved unreliable in this project, while the
// middleware demonstrably runs on every request (staging noindex header).
import { getSbConfig, sbList } from './supabase';

// ---- sitemap ----
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { xml: string; expires: number; origin: string } | null = null;

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];
const FALLBACK_ORIGIN = 'https://www.igsavego.com';

export function resolveSeoOrigin(hostname: string): string {
  const raw = (hostname || '').toLowerCase();
  if (
    raw === 'www.igsavego.com' ||
    raw === 'igsavego.com' ||
    raw.endsWith('.pages.dev') ||
    raw.startsWith('localhost')
  ) {
    return `https://${raw}`;
  }
  return FALLBACK_ORIGIN;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function buildSitemapResponse(origin: string, env: Record<string, string | undefined>): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

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

  let keywords: { slug: string }[] = [];
  let guides: { slug: string; updatedAt?: string }[] = [];
  try {
    const cfg = getSbConfig(env);
    if (cfg) {
      const [kw, gd] = await Promise.all([
        sbList(cfg, 'keyword_pages', { select: 'slug', eq: { enabled: true } }),
        sbList(cfg, 'guide_articles', { select: 'slug,updated_at', eq: { enabled: true } }),
      ]);
      keywords = kw.filter((r: any) => r.slug).map((r: any) => ({ slug: String(r.slug) }));
      guides = gd
        .filter((r: any) => r.slug)
        .map((r: any) => ({ slug: String(r.slug), updatedAt: r.updated_at || undefined }));
    }
  } catch {}

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  const urlNode = (loc: string, lastmod: string, changefreq: string, priority: string, alternates?: { hl: string; href: string }[]) => {
    let n = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;
    if (alternates) {
      for (const a of alternates) n += `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${esc(a.href)}"/>\n`;
    }
    n += `  </url>\n`;
    return n;
  };

  xml += urlNode(
    `${origin}/`,
    today,
    'daily',
    '1.0',
    [...LANGS.map((l) => ({ hl: l, href: `${origin}/${l}/video-downloader` })), { hl: 'x-default', href: `${origin}/en/video-downloader` }]
  );

  for (const lang of LANGS) {
    for (const slug of TOOL_SLUGS) {
      const pageUrl = `${origin}/${lang}/${slug}`;
      const priority = slug === 'video-downloader' || slug === 'reels-downloader' ? '0.9' : '0.8';
      xml += urlNode(
        pageUrl,
        today,
        'daily',
        priority,
        [...LANGS.map((l) => ({ hl: l, href: `${origin}/${l}/${slug}` })), { hl: 'x-default', href: `${origin}/en/${slug}` }]
      );
    }
  }

  for (const k of keywords) {
    xml += urlNode(`${origin}/${encodeURI(k.slug)}`, today, 'daily', '0.9');
  }

  xml += urlNode(`${origin}/blog`, today, 'daily', '0.8');
  for (const g of guides) {
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : today;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod, 'weekly', '0.8');
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
