// Pages Functions middleware: keep STAGING (any *.pages.dev host) out of
// search-engine indexes, while leaving the production domain untouched.
// Adds `X-Robots-Tag: noindex, nofollow` (respected by Google/Yandex/Bing
// even if a staging URL is crawled). Runs after the route handler, only
// appending a header — bodies (including media streams) pass through intact.
interface MiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const res = await context.next();
  try {
    const host = new URL(context.request.url).hostname.toLowerCase();
    if (host.endsWith('.pages.dev')) {
      const headers = new Headers(res.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    }
  } catch {
    // Never break a response because of the staging guard.
  }
  return res;
}
