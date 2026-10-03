// IGSaveGo pre-cutover site audit — zero dependencies, run with Node 18+:
//   node scripts/audit.mjs https://insta-downloader2.pages.dev
// Checks HTTP statuses, content markers, API shapes, SEO tags and security
// headers. Exit code 1 when any check FAILs (CI-friendly).
// Usage: honest signal — a FAIL means "fix before cutover", not "site down".

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Usage: node scripts/audit.mjs <base-url>');
  process.exit(2);
}
const host = new URL(base).hostname;
const isStaging = host.endsWith('.pages.dev');
const results = [];

async function fetchText(path, init) {
  const started = Date.now();
  const res = await fetch(base + path, { redirect: 'manual', ...(init || {}) });
  const text = await res.text().catch(() => '');
  return { status: res.status, headers: res.headers, text, ms: Date.now() - started };
}

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------- 1. Homepage ----------
try {
  const r = await fetchText('/');
  check('home: HTTP 200', r.status === 200, `got ${r.status} in ${r.ms}ms`);
  check('home: robots meta (index,follow)', /name="robots"[^>]*index/.test(r.text));
  check('home: canonical to www.igsavego.com', /rel="canonical"[^>]*igsavego\.com/.test(r.text));
  check('home: GA4 present', r.text.includes('G-LWXLE5CQD4'));
  check('home: yandex verification meta', /name="yandex-verification"[^>]*4778040ed943270f/.test(r.text));
  check('home: JS bundle referenced', /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(r.text));
  const xr = r.headers.get('x-robots-tag') || '';
  if (isStaging) {
    check('staging: X-Robots-Tag noindex present', /noindex/i.test(xr), `got "${xr}"`);
  } else {
    check('production: NO X-Robots-Tag noindex', !/noindex/i.test(xr), `got "${xr}"`);
  }
  check('headers: X-Content-Type-Options', (r.headers.get('x-content-type-options') || '').toLowerCase().includes('nosniff'));
  check('headers: X-Frame-Options', !!r.headers.get('x-frame-options'));
  check('headers: Referrer-Policy', !!r.headers.get('referrer-policy'));
} catch (e) {
  check('home: reachable', false, String(e.message || e));
}

// ---------- 2. Static / crawler files ----------
try {
  const r = await fetchText('/robots.txt');
  check('robots.txt: 200 + Allow + Sitemap', r.status === 200 && /Allow: \//.test(r.text) && /Sitemap:/i.test(r.text));
} catch (e) {
  check('robots.txt: reachable', false, String(e.message || e));
}
try {
  const r = await fetchText('/yandex_4778040ed943270f.html');
  check('yandex file: exact verification content', r.status === 200 && r.text.includes('Verification: 4778040ed943270f'), `got ${r.status}`);
} catch (e) {
  check('yandex file: reachable', false, String(e.message || e));
}
try {
  const r = await fetchText('/sitemap.xml');
  check('sitemap.xml: valid XML urlset', r.status === 200 && r.text.includes('<urlset'), `got ${r.status}`);
} catch (e) {
  check('sitemap.xml: reachable', false, String(e.message || e));
}

// ---------- 3. Public API ----------
async function checkJson(path, label, predicate) {
  try {
    const r = await fetchText(path);
    let data = null;
    try { data = JSON.parse(r.text); } catch {}
    check(`${label}: HTTP 200 + valid shape`, r.status === 200 && !!data && predicate(data), `got ${r.status}`);
  } catch (e) {
    check(`${label}: reachable`, false, String(e.message || e));
  }
}
// (api/sitemap returns XML, not JSON — dedicated check:)
try {
  const r = await fetchText('/api/sitemap');
  check('api/sitemap: XML urlset direct', r.status === 200 && r.text.includes('<urlset'), `got ${r.status}, ${r.text.length}b`);
} catch (e) {
  check('api/sitemap: reachable', false, String(e.message || e));
}
await checkJson('/api/keyword-pages', 'api/keyword-pages: non-empty pages', (d) => Array.isArray(d.pages) && d.pages.length > 0);
await checkJson('/api/site-settings', 'api/site-settings: settings object', (d) => !!d.settings && typeof d.settings === 'object');
await checkJson('/api/guides', 'api/guides: array', (d) => Array.isArray(d.guides));

// ---------- 4. Auth + validation behaviour ----------
try {
  const r = await fetchText('/api/admin/verify');
  check('admin/verify without token: 401', r.status === 401, `got ${r.status}`);
} catch (e) {
  check('admin/verify: reachable', false, String(e.message || e));
}
try {
  const r = await fetchText('/api/extract');
  check('extract without url: 400 JSON error', r.status === 400 && r.text.includes('error'), `got ${r.status}`);
} catch (e) {
  check('extract: reachable', false, String(e.message || e));
}

// ---------- 5. Sample content routes (SPA: 200 + app shell) ----------
for (const p of ['/en/video-downloader', '/ar/reels-downloader', '/blog', '/admin']) {
  try {
    const r = await fetchText(p);
    check(`route ${p}: 200 + app shell`, r.status === 200 && r.text.includes('id="root"'), `got ${r.status}`);
  } catch (e) {
    check(`route ${p}: reachable`, false, String(e.message || e));
  }
}

// ---------- summary ----------
const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
if (failed.length > 0) {
  console.log('Failed checks:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
