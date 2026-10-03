import { createClient } from '@supabase/supabase-js';
import { CfContext, getEnv } from '../_lib/cf';

// GET /api/sitemap (served publicly as /sitemap.xml via _redirects 200-rewrite)
// Always-fresh XML (Supabase keywords + guides), in-memory cache per isolate.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { xml: string; expires: number; origin: string } | null = null;

const TOOL_SLUGS = ['video-downloader', 'photo-downloader', 'reels-downloader', 'story-saver', 'highlights-downloader'];
const LANGS = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'id', 'tr'];
const FALLBACK_ORIGIN = 'https://www.igsavego.com';

// Host allowlist: prevents Host-header poisoning of cached canonical URLs.
function resolveOrigin(req: Request): string {
  const url = new URL(req.url);
  const raw = (url.hostname || '').toLowerCase();
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

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }
  const origin = resolveOrigin(request);
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
    const url = getEnv(env, 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
    const key = getEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
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
