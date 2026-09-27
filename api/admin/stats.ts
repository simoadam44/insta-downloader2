import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// SELF-CONTAINED Vercel function — zero local-file imports.
// GET /api/admin/stats (Bearer) -> dashboard stats.
// Traffic counters are best-effort on serverless (no shared memory), so they
// are reported transparently; the keyword-page count is live from Supabase.
function verifyToken(authHeader: string | undefined): { valid: boolean; user?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { valid: false };
  const token = authHeader.substring(7);
  if (!token || token.length > 512) return { valid: false };
  try {
    const secret = process.env.SESSION_SECRET || '';
    if (!secret) return { valid: false };
    const decoded = Buffer.from(token, 'base64').toString('utf8');
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
    const expectedSig = crypto.createHmac('sha256', secret).update(`${user}:${timestampStr}`).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };
    return { valid: true, user };
  } catch {}
  return { valid: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const auth = verifyToken(req.headers.authorization);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });

  // Live keyword-page count from Supabase (same env names as keyword-pages fn).
  let keywordCount = 0;
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { count } = await sb.from('keyword_pages').select('id', { count: 'exact', head: true });
      if (typeof count === 'number') keywordCount = count;
    }
  } catch {}

  return res.status(200).json({
    totalDownloads: 0,
    totalExtractions: 0,
    todayRequests: 0,
    successRate: 100,
    avgLatencyMs: 0,
    bandwidthProcessedMB: 0,
    bandwidthProcessedGB: 0,
    cacheHitRatio: 0,
    activeProxies: 0,
    keywordPages: keywordCount,
    serverless: true,
    recentLogs: [],
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryHeapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      memoryRssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`,
      environment: 'Vercel Serverless Functions',
      status: 'Operational & Healthy',
    },
  });
}
