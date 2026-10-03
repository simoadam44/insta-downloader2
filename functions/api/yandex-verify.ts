import type { CfContext } from '../_lib/cf';

// Yandex ownership verification, served with HTTP 200 on the EXACT
// verification URL via a _redirects 200-rewrite:
//
//   /yandex_4778040ed943270f.html  ->  /api/yandex-verify  (200)
//
// Why a function and not just the static file? Cloudflare Pages normalizes
// "*.html" URLs to their extensionless form with a 308 redirect, and Yandex
// requires the exact file URL to answer 200 with the verification content.
// The rewrite below bypasses that normalization. Content is byte-identical
// to public/yandex_4778040ed943270f.html (kept as the canonical copy).

const BODY = `<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body>Verification: 4778040ed943270f</body>
</html>
`;

export async function onRequest(context: CfContext): Promise<Response> {
  if (context.request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }
  return new Response(BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
