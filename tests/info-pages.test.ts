// Informational / legal page tests.
//
// Covers the single source of truth in src/data/infoPages.ts, the edge <head>
// injection used for the first HTML response, the sitemap output and the
// content rules (no placeholders, no unsupported claims, no noindex).
//
// Run with: npm test
// No network and no database: Supabase config is intentionally absent, so the
// edge metadata code takes its documented fail-open path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { onRequest } from '../functions/_middleware';
import { parseRoutePath, resolveCanonicalRedirect } from '../functions/_lib/seoHtml';
import { resolvePageHeadMeta } from '../functions/_lib/pageMeta';
import {
  INFO_PAGES,
  INFO_PAGE_IDS,
  INFO_PAGE_PATHS,
  INFO_PAGE_SEO,
  findInfoPage,
  infoPageById,
} from '../src/data/infoPages';

const ORIGIN = 'https://www.igsavego.com';

const SHELL = [
  '<!doctype html><html lang="en"><head>',
  '<title>Shell title</title>',
  '<meta name="description" content="Shell description" />',
  '</head><body><main>app</main></body></html>',
].join('');

async function fetchRoute(url: string, body: string = SHELL) {
  const request = new Request(url, { method: 'GET' });
  const response = await onRequest({
    request,
    env: {},
    next: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
  });
  return response;
}

function allText(page: (typeof INFO_PAGES)[keyof typeof INFO_PAGES]): string {
  const parts: string[] = [...page.intro];
  for (const section of page.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if ('text' in block) parts.push(block.text);
      if ('items' in block) parts.push(...block.items);
      if ('rows' in block) parts.push(...block.rows.flat(), ...block.head);
    }
  }
  for (const faq of page.faqs || []) parts.push(faq.question, faq.answer);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// 1. Route list and source-of-truth integrity
// ---------------------------------------------------------------------------

test('1. all seven informational routes exist exactly once', () => {
  const expected = ['/about', '/contact', '/how-to-use', '/faq', '/privacy', '/terms', '/disclaimer'];
  assert.deepEqual([...INFO_PAGE_PATHS].sort(), [...expected].sort());
  assert.equal(INFO_PAGE_IDS.length, 7);
  assert.equal(new Set(INFO_PAGE_IDS).size, 7);
  assert.equal(INFO_PAGE_SEO.length, 7);
});

test('2. every page has unique, non-empty SEO fields and content', () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const id of INFO_PAGE_IDS) {
    const page = INFO_PAGES[id];
    assert.equal(page.id, id);
    assert.equal(page.path, `/${id}`);
    assert.ok(page.title.length >= 20 && page.title.length <= 75, `${id}: title length`);
    assert.ok(page.description.length >= 80 && page.description.length <= 170, `${id}: description length`);
    assert.ok(page.h1.length > 3, `${id}: h1`);
    assert.match(page.updated, /^\d{4}-\d{2}-\d{2}$/, `${id}: updated`);
    assert.ok(page.intro.length >= 1, `${id}: intro`);
    assert.ok(page.sections.length + (page.faqs?.length || 0) >= 3, `${id}: content depth`);
    assert.ok(page.related.length >= 5, `${id}: related links`);

    assert.ok(!titles.has(page.title), `${id}: duplicate title`);
    assert.ok(!descriptions.has(page.description), `${id}: duplicate description`);
    titles.add(page.title);
    descriptions.add(page.description);
  }
});

test('3. page lookup handles trailing slashes and rejects unknown paths', () => {
  for (const id of INFO_PAGE_IDS) {
    assert.equal(findInfoPage(`/${id}`)?.id, id);
    assert.equal(findInfoPage(`/${id}/`)?.id, id);
    assert.equal(findInfoPage(`/${id.toUpperCase()}`)?.id, id);
  }
  assert.equal(findInfoPage('/not-a-page'), null);
  assert.equal(findInfoPage('/blog'), null);
  assert.equal(findInfoPage('/'), null);
  // A bare id is NOT a pathname; the router must use infoPageById().
  assert.equal(findInfoPage('privacy'), null);
  for (const id of INFO_PAGE_IDS) {
    assert.equal(infoPageById(id)?.id, id);
  }
  assert.equal(infoPageById(null), null);
});

test('4. no unresolved template tokens remain in published copy', () => {
  for (const id of INFO_PAGE_IDS) {
    // {email} is the one supported token; it is replaced at render time with
    // the configured address, so it must not appear in any other form.
    assert.doesNotMatch(allText(INFO_PAGES[id]), /\{(?!email\})[a-zA-Z]+\}/, `${id}: template token`);
    assert.doesNotMatch(allText(INFO_PAGES[id]), /TODO|TBD|Lorem ipsum/i, `${id}: placeholder`);
  }
});

test('5. pages avoid claims the code cannot support', () => {
  const banned = [
    /100%\s*anonymous/i,
    /completely\s*anonymous/i,
    /never\s*logs?/i,
    /deletes?\s*all\s*(information|data)\s*immediately/i,
    /gdpr\s*(compliant|certified)/i,
    /ccpa\s*(compliant|certified)/i,
    /world'?s\s*best/i,
    /no\s*limits?/i,
    /unlimited\s*downloads?/i,
  ];
  for (const id of INFO_PAGE_IDS) {
    const text = allText(INFO_PAGES[id]);
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${id} matched ${pattern}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Content-specific requirements from the brief
// ---------------------------------------------------------------------------

test('6. contact page exposes the configured email and a privacy notice, no fake form', () => {
  const page = INFO_PAGES.contact;
  const text = allText(page);
  assert.deepEqual(
    page.sections.filter((s) => s.blocks.some((b) => b.type === 'email')).map((s) => s.id),
    ['email']
  );
  assert.match(text, /not sold/i);
  assert.doesNotMatch(text, /<form/i);
  assert.match(text, /copyright/i);
  assert.match(text, /privacy/i);
});

test('7. privacy page reflects verified behaviour and links Google policy pages', () => {
  const text = allText(INFO_PAGES.privacy);
  assert.match(text, /Cloudflare/);
  assert.match(text, /G-LWXLE5CQD4/);
  assert.match(text, /60-second|60 seconds/);
  assert.match(text, /24 hours/);
  assert.match(text, /AdSense/);
  assert.match(text, /does not currently display advertising|not currently display advertising/i);
  assert.match(text, /https:\/\/policies\.google\.com\/technologies\/partner-sites/);
  assert.match(text, /no certification|certification of compliance/i);
});

const INFO_PRIVACY = INFO_PAGES.privacy;

test('8. terms and disclaimer avoid invented legal entities and grant no extra rights', () => {
  const terms = allText(INFO_PAGES.terms);
  const disclaimer = allText(INFO_PAGES.disclaimer);

  for (const text of [terms, disclaimer]) {
    assert.doesNotMatch(text, /LLC|Ltd\.|registered (office|address)/i);
    assert.match(text, /public/i);
  }

  assert.match(disclaimer, /not affiliated with/i);
  assert.match(disclaimer, /does not give you permission|no additional rights/i);
  assert.match(disclaimer, /does not remove/i);
  assert.match(terms, /not give you that permission|no additional rights/i);
});

test('9. how-to-use matches the real interface and flags unsupported story links', () => {
  const text = allText(INFO_PAGES['how-to-use']);
  assert.match(text, /Insert Instagram link here/);
  assert.match(text, /Paste/);
  assert.match(text, /Fetching/);
  assert.match(text, /Download Another/);
  assert.match(text, /stories/);
  assert.match(text, /not supported/i);
  assert.match(text, /60 requests per minute/);
});

test('10. FAQ has at least 12 distinct questions, including the required topics', () => {
  const faqs = INFO_PAGES.faq.faqs || [];
  assert.ok(faqs.length >= 12, `expected >=12, got ${faqs.length}`);
  assert.equal(new Set(faqs.map((f) => f.question)).size, faqs.length);

  const joined = faqs.map((f) => f.question).join('\n');
  for (const topic of [
    /What is IGSaveGo/i,
    /free/i,
    /links are supported/i,
    /mobile|phone/i,
    /not working/i,
    /private accounts/i,
    /deleted/i,
    /files saved/i,
    /store/i,
    /affiliated/i,
    /repost|commercial/i,
    /copyright/i,
    /contact/i,
  ]) {
    assert.match(joined, topic);
  }
});

// ---------------------------------------------------------------------------
// 11-13. Edge routing, first-response <head>, and no accidental noindex
// ---------------------------------------------------------------------------

test('11. parseRoutePath classifies every info page before the keyword engine', () => {
  for (const id of INFO_PAGE_IDS) {
    const route = parseRoutePath(`/${id}`);
    assert.equal(route.kind, 'info', id);
    if (route.kind === 'info') {
      assert.equal(route.infoId, id);
      assert.equal(route.path, `/${id}`);
    }
    assert.equal(parseRoutePath(`/${id}/`).kind, 'info', `${id} trailing slash`);
    assert.equal(parseRoutePath(`/${id.toUpperCase()}`).kind, 'info', `${id} uppercase`);
  }
});

test('12. every info route gets a unique title/description and one www canonical', async () => {
  for (const id of INFO_PAGE_IDS) {
    const page = INFO_PAGES[id];
    const response = await fetchRoute(`${ORIGIN}/${id}`);
    assert.equal(response.status, 200, id);
    assert.equal(response.headers.get('x-robots-tag'), null, `${id}: no noindex at the edge`);

    const html = await response.text();
    const canonicals = html.match(/<link rel="canonical" href="([^"]+)"/g) || [];
    assert.equal(canonicals.length, 1, `${id}: canonical count`);
    assert.ok(canonicals[0].includes(`${ORIGIN}/${id}"`), `${id}: canonical href`);
    assert.ok(html.includes(`<title>${page.title}</title>`) || html.includes(page.title), `${id}: title`);
    assert.ok(html.includes(page.description), `${id}: description`);
    assert.ok(html.includes(`<meta property="og:url" content="${ORIGIN}/${id}"`), `${id}: og:url`);
    assert.doesNotMatch(html, /name="robots" content="[^"]*noindex/i, `${id}: no noindex introduced`);
  }
});

test('13. apex info URLs 301 once to the www canonical', async () => {
  for (const id of INFO_PAGE_IDS) {
    const response = resolveCanonicalRedirect(new URL(`https://igsavego.com/${id}`), 'GET', {});
    assert.ok(response, id);
    assert.equal(response!.status, 301, id);
    assert.equal(response!.headers.get('location'), `${ORIGIN}/${id}`, id);
  }
});

// ---------------------------------------------------------------------------
// 14-16. Metadata helper, sitemap and robots
// ---------------------------------------------------------------------------

test('14. resolvePageHeadMeta returns the authored metadata (no brand double-replace)', async () => {
  for (const id of INFO_PAGE_IDS) {
    const page = INFO_PAGES[id];
    const meta = await resolvePageHeadMeta(`/${id}`, {}, ORIGIN);
    assert.ok(meta, id);
    assert.equal(meta!.canonicalUrl, `${ORIGIN}/${id}`);
    assert.equal(meta!.title, page.title);
    assert.equal(meta!.description, page.description);
    assert.equal(meta!.ogType, 'website');
    assert.equal(meta!.lang, 'en');
  }
});

test('15. sitemap.xml lists all seven info pages on the www origin', async () => {
  const response = await fetchRoute(`${ORIGIN}/sitemap.xml`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/xml/);
  const xml = await response.text();

  for (const id of INFO_PAGE_IDS) {
    assert.match(xml, new RegExp(`<loc>${ORIGIN.replace(/\./g, '\\.')}/${id}</loc>`), id);
    assert.match(xml, new RegExp(`<loc>[^<]*/${id}</loc>\\s*<lastmod>${INFO_PAGES[id].updated}</lastmod>`), `${id}: lastmod`);
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) assert.ok(loc.startsWith(`${ORIGIN}/`), loc);
});

test('16. robots.txt does not disallow any public info page', () => {
  const robots = readFileSync(path.join(process.cwd(), 'public', 'robots.txt'), 'utf8');
  const disallowLines = robots
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^Disallow:/i.test(line));

  for (const id of INFO_PAGE_IDS) {
    assert.ok(
      !disallowLines.some((line) => line.toLowerCase() === `disallow: /${id}`),
      `${id} must stay crawlable`
    );
  }
  assert.match(robots, /^Sitemap: https:\/\/www\.igsavego\.com\/sitemap\.xml$/m);
});
