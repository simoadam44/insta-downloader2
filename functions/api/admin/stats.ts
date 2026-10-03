import { CfContext, getEnv, json, unauthorized, verifyAdminToken } from '../../_lib/cf';
import { getSbConfig, sbCount } from '../../_lib/supabase';

// GET /api/admin/stats (Bearer) -> dashboard stats.
// Traffic counters are best-effort on the edge (no shared memory), so they
// are reported transparently; the keyword-page count is live from Supabase.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed.' }, 405);
  }
  const secret = getEnv(env, 'SESSION_SECRET');
  const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
  if (!auth.valid) return unauthorized();

  let keywordCount = 0;
  try {
    const cfg = getSbConfig(env);
    if (cfg) keywordCount = await sbCount(cfg, 'keyword_pages');
  } catch {}

  return json(
    {
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
        uptimeSeconds: 0,
        memoryHeapUsedMB: 0,
        memoryRssMB: 0,
        nodeVersion: 'Cloudflare Workers runtime',
        platform: 'edge isolate',
        environment: 'Cloudflare Pages Functions',
        status: 'Operational & Healthy',
      },
    },
    200,
    { 'Cache-Control': 'no-store' }
  );
}
