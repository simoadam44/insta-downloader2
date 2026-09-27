import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// SELF-CONTAINED Vercel function — zero local-file imports.
// POST /api/admin/login  { email?, username?, password } -> { success, token, ... }
// Password ONLY from ADMIN_PASSWORD env (fail-closed). No weak fallbacks.
const buckets = new Map<string, { count: number; reset: number }>();

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  return ((first || (req.headers['x-real-ip'] as string) || 'unknown').trim() || 'unknown').substring(0, 45);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  // Brute-force guard: 15 attempts / 15 min per IP.
  const now = Date.now();
  const key = `login:${clientIp(req)}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
  } else {
    entry.count++;
    if (entry.count > 15) {
      return res.status(429).json({ error: 'Too many failed login attempts. Please wait 15 minutes.' });
    }
  }

  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured) {
    return res.status(503).json({ error: 'Admin login is not configured (ADMIN_PASSWORD missing).' });
  }

  const body = (req.body || {}) as any;
  const pass = typeof body.password === 'string' ? body.password.trim().substring(0, 128) : '';
  if (!pass || !safeEqual(pass, configured)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  buckets.delete(key);
  const secret = process.env.SESSION_SECRET || '';
  if (!secret) {
    return res.status(503).json({ error: 'Session signing is not configured (SESSION_SECRET missing).' });
  }
  const rawId = body.email || body.username || 'admin@igsavego.com';
  const safeUser = (typeof rawId === 'string' ? rawId.replace(/[^a-zA-Z0-9@._-]/g, '') : 'admin').substring(0, 50) || 'admin';
  const timestamp = Date.now();
  const payload = `${safeUser}:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${signature}`).toString('base64');

  return res.status(200).json({
    success: true,
    token,
    expiresIn: 86400,
    user: { email: safeUser, role: 'admin' },
  });
}
