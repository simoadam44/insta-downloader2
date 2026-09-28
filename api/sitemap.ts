import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// SELF-CONTAINED Vercel function — zero local-file imports.
// GET /sitemap.xml -> always-fresh XML (Supabase keywords + guides),
// cached in memory for 24h to avoid rebuilding on every crawler hit.
// (On serverless each instance holds its own cache — harmless.)

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { xml: string; expires: number; origin: string } | null = null;

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];
const FALLBACK_ORIGIN = 'https://www.igsavego.com';

// Host allowlist: prevents Host-header poisoning of cached canonical URLs.
function resolveOrigin(req: VercelRequest): string {
  const raw = ((req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '').split(',')[0].trim().toLowerCase();
  if (
    raw === 'www.igsavego.com' ||
    raw === 'igsavego.com' ||
    raw.endsWith('.vercel.app') ||
    raw.startsWith('localhost')
  ) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    return `${proto}://${raw}`;
  }
  return FALLBACK_ORIGIN;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = resolveOrigin(req);
  const today = new Date().toISOString().split('T')[0];

  if (cached && Date.now() < cached.expires && cached.origin === origin) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Sitemap-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).send(cached.xml);
  }

  // Pull live lists from Supabase (graceful fallback to empty on any failure).
  let keywords: { slug: string }[] = [];
  let guides: { slug: string; updatedAt?: string }[] = [];
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const [kw, gd] = await Promise.all([
        sb.from('keyword_pages').select('slug').eq('enabled', true),
        sb.from('guide_articles').select('slug,updated_at').eq('enabled', true),
      ]);
      if (kw.data) keywords = kw.data.filter((r: any) => r.slug).map((r: any) => ({ slug: String(r.slug) }));
      if (gd.data) {
        guides = gd.data
          .filter((r: any) => r.slug)
          .map((r: any) => ({ slug: String(r.slug), updatedAt: r.updated_at || undefined }));
      }
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

  // Root
  xml += urlNode(
    `${origin}/`,
    today,
    'daily',
    '1.0',
    [...LANGS.map((l) => ({ hl: l, href: `${origin}/${l}/video-downloader` })), { hl: 'x-default', href: `${origin}/en/video-downloader` }]
  );

  // Tool pages × languages
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

  // Keyword landing pages
  for (const k of keywords) {
    xml += urlNode(`${origin}/${encodeURI(k.slug)}`, today, 'daily', '0.9');
  }

  // Blog hub + guide articles
  xml += urlNode(`${origin}/blog`, today, 'daily', '0.8');
  for (const g of guides) {
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : today;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod, 'weekly', '0.8');
  }

  xml += `</urlset>`;

  cached = { xml, expires: Date.now() + CACHE_TTL_MS, origin };

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Sitemap-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
