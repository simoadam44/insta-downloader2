// Shared sitemap.xml builder (used by server.ts; api/sitemap.ts keeps its own
// inlined copy because Vercel cannot bundle local imports in this project).

import { INFO_PAGE_SEO } from '../src/data/infoPages';

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];

// Date of the last real content change of the homepage and the tool pages.
// A constant on purpose: the old builder stamped every URL with "today" on
// each request, which is why Google stopped trusting this file's <lastmod>.
export const SITE_CONTENT_UPDATED = '2026-11-20';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildSitemapXml(
  origin: string,
  guides: { slug: string; updatedAt?: string }[]
): string {
  // <changefreq> and <priority> are ignored by Google and were inflated here
  // before ("daily", 1.0 everywhere), so neither is emitted any more.
  const urlNode = (loc: string, lastmod: string, alternates?: { hl: string; href: string }[]) => {
    let n = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n`;
    if (alternates) {
      for (const a of alternates) n += `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${esc(a.href)}"/>\n`;
    }
    n += `  </url>\n`;
    return n;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // The homepage is the English default: its x-default is `/`, not
  // /en/video-downloader, which contradicted the homepage's own canonical.
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

  // Keyword landing pages are not listed: /<slug> now 301s to the homepage.
  xml += urlNode(`${origin}/blog`, SITE_CONTENT_UPDATED);
  for (const g of guides) {
    if (!g.slug) continue;
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : SITE_CONTENT_UPDATED;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod);
  }

  for (const page of INFO_PAGE_SEO) {
    xml += urlNode(`${origin}${page.path}`, page.updated);
  }

  xml += `</urlset>`;
  return xml;
}
