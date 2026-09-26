import type { VercelRequest, VercelResponse } from '@vercel/node';

// Zero-dependency probe: isolates whether the functions runtime itself works.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, runtime: process.version, now: Date.now() });
}
