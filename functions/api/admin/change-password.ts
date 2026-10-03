import { CfContext, getEnv, json, methodNotAllowed, verifyAdminToken } from '../../_lib/cf';

// POST /api/admin/change-password is NOT supported on serverless/edge: there is
// no shared memory between isolates, so an in-memory password change would apply
// to one isolate only (security theater).
// The admin password lives in the ADMIN_PASSWORD env var instead.
export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'POST') return methodNotAllowed();
  const secret = getEnv(env, 'SESSION_SECRET');
  const auth = await verifyAdminToken(request.headers.get('authorization'), secret);
  if (!auth.valid) {
    return json({ error: 'Session expired or invalid authorization token.' }, 401);
  }
  return json(
    {
      error:
        'Password change is managed via the ADMIN_PASSWORD environment variable (Cloudflare Pages → Settings → Environment Variables), then Redeploy. Edge isolates share no memory, so an in-app change would not apply.',
    },
    501
  );
}
