import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, setSecurityHeaders } from './_security';

// Probe #2: isolates whether api/_security.ts breaks the bundle.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (checkRateLimit(req, 'probe2', 100, 60 * 1000)) {
    return res.status(429).json({ limited: true });
  }
  return res.status(200).json({ ok: true });
}
