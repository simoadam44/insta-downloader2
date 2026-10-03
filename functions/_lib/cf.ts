// Shared Cloudflare Pages Functions helpers (Workers runtime — NO Node.js
// builtins: no `crypto` import, no Buffer, no process.env).
// Mirrors the auth/rate-limit/sanitize semantics of server.ts + api/* so
// behavior (including admin session tokens) stays identical across hosts.

export interface CfContext {
  request: Request;
  env: Record<string, string | undefined>;
  params: Record<string, string | string[]>;
  waitUntil?(p: Promise<unknown>): void;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// First non-empty value among env names (accepts both manual and
// integration-synced names, same as the Vercel/Express code).
export function getEnv(env: Record<string, string | undefined>, ...names: string[]): string {
  for (const n of names) {
    const v = env?.[n];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

// ---- base64 (standard alphabet, ASCII-safe payloads like our tokens) ----
export function b64decode(input: string): string | null {
  try {
    const bin = atob(input.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return dec.decode(bytes);
  } catch {
    return null;
  }
}

// ---- HMAC-SHA256 (Web Crypto) ----
export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string compare (blocks timing attacks on tokens).
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Admin Bearer verification — byte-identical semantics to server.ts / api/*:
// base64("user:timestamp:hmacHex(secret, 'user:timestamp')"), 24h expiry.
// Client-fabricated "fallback_admin_token_*" strings are NEVER valid here.
export async function verifyAdminToken(
  authHeader: string | null,
  secret: string
): Promise<{ valid: boolean; user?: string }> {
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.substring(7);
  if (!token || token.length > 512 || token.startsWith('fallback_admin_token_')) return { valid: false };
  const decoded = b64decode(token);
  if (!decoded) return { valid: false };
  const sep1 = decoded.indexOf(':');
  const sep2 = decoded.lastIndexOf(':');
  if (sep1 <= 0 || sep2 <= sep1) return { valid: false };
  const user = decoded.substring(0, sep1);
  const timestampStr = decoded.substring(sep1 + 1, sep2);
  const signature = decoded.substring(sep2 + 1);
  if (!user || user.length > 50) return { valid: false };
  const timestamp = Number(timestampStr);
  if (!timestamp || isNaN(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    return { valid: false };
  }
  const expectedSig = await hmacHex(secret, `${user}:${timestampStr}`);
  if (safeEqual(signature, expectedSig)) return { valid: true, user };
  return { valid: false };
}

// ---- per-isolate sliding-window rate limiter (same semantics as server.ts) ----
const buckets = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(req: Request, scope: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false; // not limited
  }
  if (entry.count >= max) return true; // limited
  entry.count++;
  return false;
}

// Spoof-resistant client IP: cf-connecting-ip is set by Cloudflare itself.
export function getClientIp(req: Request): string {
  const h = req.headers;
  const cf = (h.get('cf-connecting-ip') || '').trim();
  if (cf) return cf.substring(0, 45);
  const xff = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  if (xff) return xff.substring(0, 45);
  return 'unknown';
}

// ---- responses ----
export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders || {}),
    },
  });
}

export function methodNotAllowed(): Response {
  return json({ error: 'Method not allowed.' }, 405);
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}
