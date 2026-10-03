import { CfContext, getEnv, json, verifyAdminToken } from '../../_lib/cf';

// GET /api/admin/verify  (Bearer) -> { valid, user }
export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed.' }, 405);
  }
  const secret = getEnv(env, 'SESSION_SECRET');
  const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
  if (!auth.valid) {
    return json({ valid: false, error: 'Authorization token invalid or expired.' }, 401, {
      'Cache-Control': 'no-store',
    });
  }
  return json(
    { valid: true, user: { email: auth.user || 'admin@igsavego.com', role: 'admin' } },
    200,
    { 'Cache-Control': 'no-store' }
  );
}
