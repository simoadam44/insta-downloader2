// Canonical-host + SEO signal tests for the Cloudflare Pages middleware.
//
// Run with:  npm test
// No network and no database: Supabase config is intentionally absent, so the
// sitemap/metadata code takes its documented fail-open path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { onRequest } from '../functions/_middleware';
import { resolveCanonicalRedirect } from '../functions/_lib/seoHtml';
import { resolvePageHeadMeta } from '../functions/_lib/pageMeta';

const SHELL = [
  '<!doctype html><html lang="en"><head>',
  '<title>Shell title</title>',
  '<meta name="description" content="Shell description" />',
  '</head><body><main>app</main></body></html>',
].join('');

interface CtxOptions {
  method?: string;
  body?: string;
  contentType?: string;
  status?: number;
  env?: Record<string, string | undefined>;
}

function makeContext(url: string, options: CtxOptions = {}) {
  const method = options.method || 'GET';
  const request = new Request(url, { method });
  let nextCalls = 0;

  const next = async () => {
    nextCalls += 1;
    return new Response(method === 'HEAD' ? null : options.body ?? SHELL, {
      status: options.status ?? 200,
      headers: { 'content-type': options.contentType ?? 'text/html; charset=utf-8' },
    });
  };

  return {
    context: { request, env: options.env ?? {}, next },
    nextCalls: () => nextCalls,
  };
}

async function redirectFor(url: string, options: CtxOptions = {}) {
  const { context, nextCalls } = makeContext(url, options);
  const response = await onRequest(context);
  return { response, nextCalls: nextCalls() };
}

function locationOf(response: Response): string {
  return response.headers.get('location') || '';
}

// ---------------------------------------------------------------------------
// 1-3. HTTPS apex -> HTTPS www, paths and query strings preserved
// ---------------------------------------------------------------------------

test('1. https apex homepage 301s to https www', async () => {
  const { response, nextCalls } = await redirectFor('https://igsavego.com/');
  assert.equal(response.status, 301);
  assert.equal(locationOf(response), 'https://www.igsavego.com/');
  assert.equal(nextCalls, 0);
});

test('2. https apex nested routes keep their path', async () => {
  for (const pathname of ['/blog/example-post', '/en/photo-downloader', '/privacy', '/faq/']) {
    const { response } = await redirectFor(`https://igsavego.com${pathname}`);
    assert.equal(response.status, 301, pathname);
    assert.equal(locationOf(response), `https://www.igsavego.com${pathname}`, pathname);
  }
});

test('3. query strings and encoded paths are preserved', async () => {
  const cases = [
    '/faq?source=test',
    '/blog/example?utm_source=test&utm_medium=email',
    '/blog/%D8%AD%D9%81%D8%B8-%D8%B3%D8%AA%D9%88%D8%B1%D9%8A?x=1',
  ];
  for (const suffix of cases) {
    const { response } = await redirectFor(`https://igsavego.com${suffix}`);
    assert.equal(response.status, 301, suffix);
    assert.equal(locationOf(response), `https://www.igsavego.com${suffix}`, suffix);
  }
});

// ---------------------------------------------------------------------------
// 4-6. HTTP variants and the canonical host itself
// ---------------------------------------------------------------------------

test('4. http www reaches https www', async () => {
  const { response } = await redirectFor('http://www.igsavego.com/faq');
  assert.equal(response.status, 301);
  assert.equal(locationOf(response), 'https://www.igsavego.com/faq');
});

test('5. http apex reaches https www in one Worker hop', async () => {
  const { response } = await redirectFor('http://igsavego.com/faq?x=1');
  assert.equal(response.status, 301);
  assert.equal(locationOf(response), 'https://www.igsavego.com/faq?x=1');
});

test('6. canonical https www is never redirected (no loop)', async () => {
  const { response, nextCalls } = await redirectFor('https://www.igsavego.com/faq');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(nextCalls, 1);
});

test('6b. canonical https www homepage gets exactly one self-canonical', async () => {
  const { response } = await redirectFor('https://www.igsavego.com/');
  const html = await response.text();
  const canonicals = html.match(/<link rel="canonical" href="([^"]+)"/g) || [];
  assert.equal(canonicals.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.igsavego\.com\/"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.igsavego\.com\/"/);
});

// ---------------------------------------------------------------------------
// 7. Unknown paths preserve their route (final status documented)
// ---------------------------------------------------------------------------

test('7. unknown paths preserve path/query (final status stays app-controlled)', async () => {
  const { response } = await redirectFor('https://igsavego.com/this-page-does-not-exist?x=1');
  assert.equal(response.status, 301);
  assert.equal(locationOf(response), 'https://www.igsavego.com/this-page-does-not-exist?x=1');

  // Follow the chain inside the Worker. The SPA currently answers 200 for
  // unknown routes (pre-existing soft-404, unchanged in this task); the test
  // asserts the redirect never rewrites the path, not a status we do not serve.
  const { response: final, nextCalls } = await redirectFor(
    'https://www.igsavego.com/this-page-does-not-exist?x=1',
    { status: 200, body: SHELL, contentType: 'text/html; charset=utf-8' }
  );
  assert.equal(final.status, 200);
  assert.equal(final.headers.get('location'), null);
  assert.equal(nextCalls, 1);
});

// ---------------------------------------------------------------------------
// 8-9. API behaviour: never redirected, bodies untouched
// ---------------------------------------------------------------------------

test('8. POST /api/extract on the apex is not redirected', async () => {
  const payload = '{"url":"https://www.instagram.com/p/DYCNJV0NirM/"}';
  const { response, nextCalls } = await redirectFor('https://igsavego.com/api/extract', {
    method: 'POST',
    body: payload,
    contentType: 'application/json; charset=utf-8',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(nextCalls, 1);
  assert.equal(await response.text(), payload);
});

test('9. GET and HEAD /api/extract on the apex keep working (no redirect)', async () => {
  for (const method of ['GET', 'HEAD']) {
    const payload = '{"id":"DYCNJV0NirM","mediaType":"video"}';
    const { response } = await redirectFor('https://igsavego.com/api/extract?url=x', {
      method,
      body: payload,
      contentType: 'application/json; charset=utf-8',
    });
    assert.equal(response.status, 200, method);
    assert.equal(response.headers.get('location'), null, method);
    if (method === 'GET') assert.equal(await response.text(), payload);
  }
});

test('9b. POST API on the canonical host is untouched too', async () => {
  const payload = '{"ok":true}';
  const { response } = await redirectFor('https://www.igsavego.com/api/extract', {
    method: 'POST',
    body: payload,
    contentType: 'application/json; charset=utf-8',
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), payload);
});

// ---------------------------------------------------------------------------
// 10. Preview hosts, localhost and lookalikes are never redirected
// ---------------------------------------------------------------------------

test('10. preview/localhost/lookalike hosts are not redirected', async () => {
  const hosts = [
    'https://abc123.insta-downloader2.pages.dev/',
    'http://localhost:3000/',
    'https://igsavego.workers.dev/',
    'https://igsavego.com.evil.example/',
    'https://not-igsavego.com/',
  ];
  for (const url of hosts) {
    const { response, nextCalls } = await redirectFor(url);
    assert.notEqual(response.status, 301, url);
    assert.equal(response.headers.get('location'), null, url);
    assert.equal(nextCalls, 1, url);
  }
});

test('10b. preview hosts still get the staging noindex header', async () => {
  const { response } = await redirectFor('https://abc123.insta-downloader2.pages.dev/');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});

// ---------------------------------------------------------------------------
// 11. Invalid/missing canonical configuration fails safely
// ---------------------------------------------------------------------------

test('11. invalid or missing canonical config falls back to https www', async () => {
  const envs: Array<Record<string, string | undefined>> = [
    {},
    { CANONICAL_ORIGIN: 'https://evil.example' },
    { CANONICAL_ORIGIN: 'http://igsavego.com' },
    { CANONICAL_ORIGIN: 'not-a-url' },
    { SITE_URL: 'javascript:alert(1)' },
    { CANONICAL_ORIGIN: 'https://igsavego.com' },
  ];
  for (const env of envs) {
    const response = resolveCanonicalRedirect(new URL('https://igsavego.com/faq?x=1'), 'GET', env);
    assert.ok(response, JSON.stringify(env));
    assert.equal(response!.status, 301, JSON.stringify(env));
    assert.equal(response!.headers.get('location'), 'https://www.igsavego.com/faq?x=1', JSON.stringify(env));
  }
});

// ---------------------------------------------------------------------------
// 12-14. Sitemap, robots.txt, page metadata
// ---------------------------------------------------------------------------

test('12. every sitemap URL uses https www (apex sitemap redirects first)', async () => {
  const apex = await redirectFor('https://igsavego.com/sitemap.xml');
  assert.equal(apex.response.status, 301);
  assert.equal(locationOf(apex.response), 'https://www.igsavego.com/sitemap.xml');

  const { response } = await redirectFor('https://www.igsavego.com/sitemap.xml');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/xml/);

  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 40, `expected >=40 URLs, got ${locs.length}`);
  for (const loc of locs) {
    assert.ok(loc.startsWith('https://www.igsavego.com/'), loc);
  }
  assert.ok(!locs.some((loc) => /^https:\/\/igsavego\.com\//.test(loc)));
});

test('13. robots.txt points at the canonical sitemap', () => {
  const robots = readFileSync(path.join(process.cwd(), 'public', 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/www\.igsavego\.com\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /^Sitemap: https:\/\/igsavego\.com\/sitemap\.xml$/m);
});

test('14. page canonical metadata uses the www host and keeps the route path', async () => {
  const home = await resolvePageHeadMeta('/', {}, 'https://www.igsavego.com');
  assert.equal(home?.canonicalUrl, 'https://www.igsavego.com/');

  const tool = await resolvePageHeadMeta('/en/photo-downloader', {}, 'https://www.igsavego.com');
  assert.equal(tool?.canonicalUrl, 'https://www.igsavego.com/en/photo-downloader');

  const langRoot = await resolvePageHeadMeta('/es', {}, 'https://www.igsavego.com');
  assert.equal(langRoot?.canonicalUrl, 'https://www.igsavego.com/es/video-downloader');

  const blog = await resolvePageHeadMeta('/blog', {}, 'https://www.igsavego.com');
  assert.equal(blog?.canonicalUrl, 'https://www.igsavego.com/blog');

  // DB-backed pages fail open (no canonical) when Supabase is not configured.
  const keyword = await resolvePageHeadMeta('/instagram-video-downloader', {}, 'https://www.igsavego.com');
  assert.equal(keyword, null);
});

// ---------------------------------------------------------------------------
// 15. Static assets and downloader responses pass through untouched
// ---------------------------------------------------------------------------

test('15. static assets on www pass through untouched; apex assets redirect', async () => {
  const js = 'console.log("asset");';
  const { response } = await redirectFor('https://www.igsavego.com/assets/app.js', {
    body: js,
    contentType: 'application/javascript; charset=utf-8',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/javascript; charset=utf-8');
  assert.equal(await response.text(), js);

  const apex = await redirectFor('https://igsavego.com/assets/app.js');
  assert.equal(apex.response.status, 301);
  assert.equal(locationOf(apex.response), 'https://www.igsavego.com/assets/app.js');
});
