import type { VercelRequest, VercelResponse } from '@vercel/node';

// Probe #3: identical security logic INLINED (zero local imports).
const buckets = new Map<string, { count: number; reset: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  const ip = (first || 'unknown').trim().substring(0, 45);
  const now = Date.now();
  const key = `probe3:${ip}`;
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + 60 * 1000 });
  } else {
    entry.count++;
  }
  return res.status(200).json({ ok: true, ip });
}
