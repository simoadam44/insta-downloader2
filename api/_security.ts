import type { VercelRequest, VercelResponse } from '@vercel/node';

// Shared security headers + best-effort per-instance rate limiting for
// Vercel serverless functions (instances are ephemeral, so this complements
// — not replaces — upstream limits).

export function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function getClientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  const ip = (first || (req.headers['x-real-ip'] as string) || 'unknown').trim();
  return ip.substring(0, 45);
}

const buckets = new Map<string, { count: number; reset: number }>();

// Returns true when the request is over the limit (caller must 429).
export function checkRateLimit(req: VercelRequest, scope: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  // Opportunistic cleanup to bound memory on long-lived instances.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const key = `${scope}:${getClientIp(req)}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}
