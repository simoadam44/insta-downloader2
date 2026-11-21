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

// Date of the last real content change of the homepage and tool pages. A
// constant on purpose: stamping every URL with "today" on each deploy is what
// made Google distrust this sitemap's <lastmod>.
const SITE_CONTENT_UPDATED = '2026-11-21';

// Inlined list of the bundled blog guides - this function has no local imports.
// Keep in sync with DEFAULT_GUIDES in src/data/guides.ts, otherwise a new
// article is served but never listed here.
const DEFAULT_GUIDE_SLUGS = [
  'تحميل-ريلز-انستقرام-للايفون-بدون-برامج',
  'حفظ-ستوري-انستقرام-بدون-ما-يدري',
  'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية',
  'download-instagram-reels-on-iphone-without-app',
  'save-instagram-story-anonymously',
  'download-instagram-photos-to-android-gallery',
  'تحميل-ستوري-انستقرام-حساب-خاص',
  'تنزيل-صوت-الريلز-انستقرام-mp3',
  'تعذر-تحميل-فيديو-انستقرام-على-الايفون',
  'حفظ-هايلايت-انستقرام-مع-الغلاف',
  'تحميل-صور-انستقرام-كاروسيل-دفعة-واحدة',
  'تحميل-فيديو-انستقرام-بدون-علامة-مائية-1080p',
  'تحميل-ريلز-انستقرام-على-الاندرويد-بسرعة',
  'download-instagram-story-private-account',
  'instagram-reels-to-mp3-audio-download',
  'instagram-video-download-not-working-iphone',
  'save-instagram-highlights-with-cover',
  'download-instagram-carousel-photos',
  'instagram-video-downloader-no-watermark-1080p',
  'download-instagram-video-on-pc-windows',
];

// Inlined copy of INFO_PAGE_SEO from src/data/infoPages.ts (this Vercel
// function deliberately has no local imports). Keep in sync when a page's
// `updated` value changes.
const INFO_PAGES = [
  { path: '/about', updated: '2026-10-27' },
  { path: '/contact', updated: '2026-10-27' },
  { path: '/how-to-use', updated: '2026-10-27' },
  { path: '/faq', updated: '2026-10-27' },
  { path: '/privacy', updated: '2026-11-15' },
  { path: '/terms', updated: '2026-11-15' },
  { path: '/disclaimer', updated: '2026-11-15' },
  { path: '/bluesky-downloader', updated: '2026-11-15' },
  { path: '/linkedin-downloader', updated: '2026-11-15' },
  { path: '/pinterest-downloader', updated: '2026-11-15' },
  { path: '/lemon8-downloader', updated: '2026-11-16' },
  { path: '/loom-downloader', updated: '2026-11-16' },
  { path: '/twitter-downloader', updated: '2026-11-18' },
];

// Host allowlist: prevents Host-header poisoning of cached canonical URLs.
// The primary canonical host is www (the apex 301s there), so both production
// hostnames collapse to https://www.igsavego.com.
function resolveOrigin(req: VercelRequest): string {
  const raw = ((req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '').split(',')[0].trim().toLowerCase();
  if (raw === 'www.igsavego.com' || raw === 'igsavego.com') {
    return 'https://www.igsavego.com';
  }
  if (raw.endsWith('.vercel.app') || raw.startsWith('localhost')) {
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
  let guides: { slug: string; updatedAt?: string }[] = [];
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const gd = await sb.from('guide_articles').select('slug,updated_at').eq('enabled', true);
      if (gd.data) {
        guides = gd.data
          .filter((r: any) => r.slug)
          .map((r: any) => ({ slug: String(r.slug), updatedAt: r.updated_at || undefined }));
      }
    }
  } catch {}

  // Bundled guides first (so a deploy is discoverable before any DB row), then
  // DB rows override them by slug.
  const bySlug = new Map<string, { slug: string; updatedAt?: string }>();
  for (const slug of DEFAULT_GUIDE_SLUGS) bySlug.set(slug, { slug });
  for (const g of guides) if (g.slug) bySlug.set(g.slug, g);
  guides = Array.from(bySlug.values());

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Google ignores <changefreq>/<priority>; the old values ("daily", 1.0 on
  // every URL) were also inflated, so both are gone.
  const urlNode = (loc: string, lastmod: string, alternates?: { hl: string; href: string }[]) => {
    let n = `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n`;
    if (alternates) {
      for (const a of alternates) n += `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${esc(a.href)}"/>\n`;
    }
    n += `  </url>\n`;
    return n;
  };

  // The homepage is the English default: its x-default is `/`, not
  // /en/video-downloader (that contradicted the homepage's own canonical).
  xml += urlNode(
    `${origin}/`,
    SITE_CONTENT_UPDATED,
    [
      { hl: 'en', href: `${origin}/` },
      ...LANGS.filter((l) => l !== 'en').map((l) => ({ hl: l, href: `${origin}/${l}/video-downloader` })),
      { hl: 'x-default', href: `${origin}/` },
    ]
  );

  // Tool pages × languages
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

  // Keyword landing pages are intentionally not listed: /<slug> now 301s to the
  // homepage, so they are redirects, not pages.

  // Blog hub + guide articles
  xml += urlNode(`${origin}/blog`, SITE_CONTENT_UPDATED);
  for (const g of guides) {
    const lastmod = g.updatedAt ? g.updatedAt.split('T')[0] : SITE_CONTENT_UPDATED;
    xml += urlNode(`${origin}/blog/${encodeURI(g.slug)}`, lastmod);
  }

  // Informational and legal pages
  for (const page of INFO_PAGES) {
    xml += urlNode(`${origin}${page.path}`, page.updated);
  }

  xml += `</urlset>`;

  cached = { xml, expires: Date.now() + CACHE_TTL_MS, origin };

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Sitemap-Cache', 'MISS');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
