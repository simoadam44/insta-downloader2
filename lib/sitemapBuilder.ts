// Shared sitemap.xml builder (used by server.ts; api/sitemap.ts keeps its own
// inlined copy because Vercel cannot bundle local imports in this project).

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildSitemapXml(
  origin: string,
  keywords: { slug: string }[],
  guides: { slug: string; updatedAt?: string }[],
  today: string = new Date().toISOString().split('T')[0]
): string {
  const urlNode = (loc: string, lastmod: string, changefreq: string, priority: string, alternates?: { hl: string; href: string }[]) => {
    let n = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;
    if (alternates) {
      for (const a of alternates) n += `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${esc(a.href)}"/>\n`;
    }
    n += `  </url>\n`;
    return n;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

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
    if (k.slug) xml += urlNode(`${origin}/${encodeURI(k.slug)}`, today, 'daily', '0.9');
  }

  xml += urlNode(`${origin}/blog`, today, 'daily', '0.8');
  for (const g of guides) {
    if (!g.slug) continue;
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : today;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod, 'weekly', '0.8');
  }

  xml += `</urlset>`;
  return xml;
}
