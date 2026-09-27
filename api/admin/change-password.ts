import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// SELF-CONTAINED Vercel function — zero local-file imports.
// POST /api/admin/change-password is NOT supported on serverless: there is
// no shared memory between function instances, so an in-memory password
// change would apply to one instance only (security theater).
// The admin password lives in the ADMIN_PASSWORD env var instead.
function verifyToken(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  if (!token || token.length > 512) return false;
  try {
    const secret = process.env.SESSION_SECRET || '';
    if (!secret) return false;
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const sep1 = decoded.indexOf(':');
    const sep2 = decoded.lastIndexOf(':');
    if (sep1 <= 0 || sep2 <= sep1) return false;
    const timestamp = Number(decoded.substring(sep1 + 1, sep2));
    if (!timestamp || isNaN(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) return false;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${decoded.substring(0, sep1)}:${decoded.substring(sep1 + 1, sep2)}`)
      .digest('hex');
    const a = Buffer.from(decoded.substring(sep2 + 1), 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {}
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Session expired or invalid authorization token.' });
  }
  return res.status(501).json({
    error:
      'Password change is managed via the ADMIN_PASSWORD environment variable (Vercel → Settings → Environment Variables), then Redeploy. Serverless functions share no memory, so an in-app change would not apply.',
  });
}
