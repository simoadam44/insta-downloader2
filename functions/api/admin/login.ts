import { b64encode, CfContext, getClientIp, getEnv, hmacHex, json, methodNotAllowed, safeEqual } from '../../_lib/cf';

// POST /api/admin/login  { email?, username?, password } -> { success, token, ... }
// Password ONLY from ADMIN_PASSWORD env (fail-closed). No weak fallbacks.
const buckets = new Map<string, { count: number; reset: number }>();

export async function onRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'POST') return methodNotAllowed();

  // Brute-force guard: 15 attempts / 15 min per IP; cleared on success.
  const key = `login:${getClientIp(request)}`;
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
  } else {
    entry.count++;
    if (entry.count > 15) {
      return json({ error: 'Too many failed login attempts. Please wait 15 minutes.' }, 429);
    }
  }

  const configured = getEnv(env, 'ADMIN_PASSWORD');
  if (!configured) {
    return json({ error: 'Admin login is not configured (ADMIN_PASSWORD missing).' }, 503);
  }

  const body = (await request.json().catch(() => null)) as any;
  const pass = typeof body?.password === 'string' ? body.password.trim().substring(0, 128) : '';
  if (!pass || !safeEqual(pass, configured)) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  buckets.delete(key);
  const secret = getEnv(env, 'SESSION_SECRET');
  if (!secret) {
    return json({ error: 'Session signing is not configured (SESSION_SECRET missing).' }, 503);
  }
  const rawId = body?.email || body?.username || 'admin@igsavego.com';
  const safeUser =
    (typeof rawId === 'string' ? rawId.replace(/[^a-zA-Z0-9@._-]/g, '') : 'admin').substring(0, 50) || 'admin';
  const timestamp = Date.now();
  const payload = `${safeUser}:${timestamp}`;
  const signature = await hmacHex(secret, payload);
  const token = b64encode(`${payload}:${signature}`);

  return json(
    { success: true, token, expiresIn: 86400, user: { email: safeUser, role: 'admin' } },
    200,
    { 'Cache-Control': 'no-store' }
  );
}
