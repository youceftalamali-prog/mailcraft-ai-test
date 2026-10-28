import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Pool } from 'pg';

interface Env {
  AUTH_DB: { connectionString: string };
  APP_ORIGIN: string;
  ADMIN_BOOTSTRAP_TOKEN: string;
}
type Variables = { user: { id: string; email: string; role: string; plan: string; status: string } };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
const SESSION_COOKIE = '__Host-mailcraft_session';
const SESSION_DAYS = 14;
const encoder = new TextEncoder();

function db(c: { env: Env }) {
  return new Pool({ connectionString: c.env.AUTH_DB.connectionString, max: 3, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000 });
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((x) => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310_000 }, key, 256);
  const hex = (v: Uint8Array) => [...v].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt: hex(salt), hash: hex(new Uint8Array(bits)) };
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterationsText, salt, expected] = stored.split('$');
  if (algorithm !== 'pbkdf2-sha256' || Number(iterationsText) !== 310_000 || !salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return actual.hash === expected;
}
function passwordRecord(salt: string, hash: string) { return `pbkdf2-sha256$310000$${salt}$${hash}`; }
function validEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}
function sameOrigin(c: { req: { header: (name: string) => string | undefined }; env: Env }) {
  const origin = c.req.header('origin');
  return Boolean(origin && origin === c.env.APP_ORIGIN);
}
function cookieOptions(expires: Date) {
  return { httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/', expires };
}
async function createSession(pool: Pool, userId: string) {
  const token = randomToken();
  const tokenHash = await digest(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO app_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, tokenHash, expires]);
  return { token, expires };
}
async function rateLimited(pool: Pool, key: string, maxAttempts: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const resetBefore = new Date(now.getTime() - windowMs);
  const result = await pool.query(
    `INSERT INTO app_rate_limits (bucket_key, window_started_at, attempts)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_started_at = CASE WHEN app_rate_limits.window_started_at < $3 THEN EXCLUDED.window_started_at ELSE app_rate_limits.window_started_at END,
       attempts = CASE WHEN app_rate_limits.window_started_at < $3 THEN 1 ELSE app_rate_limits.attempts + 1 END
     RETURNING attempts, window_started_at`,
    [key, now, resetBefore],
  );
  return Number(result.rows[0]?.attempts ?? maxAttempts + 1) > maxAttempts;
}
function clientKey(c: { req: { header: (name: string) => string | undefined } }, action: string) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  return `${action}:${ip}`.slice(0, 200);
}

app.use('/api/auth/*', async (c, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method) && !sameOrigin(c)) {
    return c.json({ error: 'Invalid request origin' }, 403);
  }
  await next();
});
app.get('/api/health', (c) => c.json({ ok: true, service: 'mailcraft-auth-api' }));

app.post('/api/auth/signup', async (c) => {
  const pool = db(c);
  try {
    if (await rateLimited(pool, clientKey(c, 'signup'), 8, 15 * 60 * 1000)) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
    const body = await c.req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!validEmail(email) || !validPassword(password)) {
      return c.json({ error: 'Enter a valid email and a password of 12–128 characters.' }, 400);
    }
    const credentials = await hashPassword(password);
    const record = passwordRecord(credentials.salt, credentials.hash);
    const inserted = await pool.query(
      `INSERT INTO app_users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role, plan, status`,
      [email, record],
    );
    const user = inserted.rows[0];
    if (!user) return c.json({ error: 'Unable to create account with those details.' }, 409);
    const session = await createSession(pool, user.id);
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expires));
    return c.json({ user }, 201);
  } catch (error) {
    console.error('signup failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Account creation is temporarily unavailable.' }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
});

app.post('/api/auth/login', async (c) => {
  const pool = db(c);
  try {
    if (await rateLimited(pool, clientKey(c, 'login'), 10, 15 * 60 * 1000)) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
    const body = await c.req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!validEmail(email) || typeof password !== 'string' || password.length > 128) return c.json({ error: 'Invalid email or password.' }, 400);
    const found = await pool.query('SELECT id, email, password_hash, role, plan, status FROM app_users WHERE email = $1 LIMIT 1', [email]);
    const user = found.rows[0];
    const matches = user ? await verifyPassword(password, user.password_hash) : false;
    if (!matches || user.status !== 'active') return c.json({ error: 'Invalid email or password.' }, 401);
    const session = await createSession(pool, user.id);
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expires));
    return c.json({ user: { id: user.id, email: user.email, role: user.role, plan: user.plan, status: user.status } });
  } catch (error) {
    console.error('login failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Sign in is temporarily unavailable.' }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
});

app.get('/api/auth/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ user: null });
  const pool = db(c);
  try {
    const tokenHash = await digest(token);
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.plan, u.status
       FROM app_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1`,
      [tokenHash],
    );
    return c.json({ user: result.rows[0] ?? null });
  } catch (error) {
    console.error('session lookup failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Session lookup is temporarily unavailable.' }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  const pool = db(c);
  try {
    if (token) await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [await digest(token)]);
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true, sameSite: 'Lax' });
    return c.json({ ok: true });
  } catch (error) {
    console.error('logout failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Sign out is temporarily unavailable.' }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
});

// One-time bootstrap: use a strong Wrangler secret; never expose it to the browser.
// This route should be removed after the first administrator is created.
app.post('/api/auth/admin-bootstrap', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Invalid request origin' }, 403);
  const supplied = c.req.header('x-admin-bootstrap-token');
  if (!supplied || !c.env.ADMIN_BOOTSTRAP_TOKEN || supplied !== c.env.ADMIN_BOOTSTRAP_TOKEN) return c.json({ error: 'Forbidden' }, 403);
  const pool = db(c);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const count = await client.query("SELECT count(*)::int AS count FROM app_users WHERE role = 'admin'");
    if (Number(count.rows[0]?.count) > 0) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Administrator is already configured.' }, 409);
    }
    const body = await c.req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!validEmail(email) || !validPassword(password)) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Enter a valid email and a password of 12–128 characters.' }, 400);
    }
    const credentials = await hashPassword(password);
    const inserted = await client.query(
      "INSERT INTO app_users (email, password_hash, role, plan) VALUES ($1, $2, 'admin', 'business') ON CONFLICT (email) DO NOTHING RETURNING id, email, role, plan",
      [email, passwordRecord(credentials.salt, credentials.hash)],
    );
    if (!inserted.rows[0]) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Unable to bootstrap administrator.' }, 409);
    }
    await client.query('INSERT INTO app_audit_events (actor_user_id, event_type, target_user_id) VALUES ($1, $2, $1)', [inserted.rows[0].id, 'admin.bootstrap']);
    await client.query('COMMIT');
    return c.json({ user: inserted.rows[0], note: 'Remove this endpoint and rotate ADMIN_BOOTSTRAP_TOKEN immediately.' }, 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('admin bootstrap failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Administrator setup is temporarily unavailable.' }, 500);
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
});

app.get('/api/admin/overview', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Authentication required.' }, 401);
  const pool = db(c);
  try {
    const session = await pool.query(
      `SELECT u.id, u.email, u.role FROM app_sessions s JOIN app_users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active' LIMIT 1`,
      [await digest(token)],
    );
    const user = session.rows[0];
    if (!user) return c.json({ error: 'Authentication required.' }, 401);
    if (user.role !== 'admin') return c.json({ error: 'Administrator access required.' }, 403);
    const [users, plans, usage] = await Promise.all([
      pool.query('SELECT count(*)::int AS total FROM app_users'),
      pool.query('SELECT plan, count(*)::int AS users FROM app_users GROUP BY plan ORDER BY plan'),
      pool.query('SELECT COALESCE(sum(campaigns_count),0)::int AS campaigns, COALESCE(sum(images_count),0)::int AS images, COALESCE(sum(voice_count),0)::int AS voice FROM app_usage WHERE period_start >= date_trunc(\'month\', now())::date'),
    ]);
    return c.json({ users: users.rows[0]?.total ?? 0, plans: plans.rows, usage: usage.rows[0] });
  } catch (error) {
    console.error('admin overview failed', error instanceof Error ? error.message : 'unknown');
    return c.json({ error: 'Admin overview is temporarily unavailable.' }, 500);
  } finally {
    await pool.end().catch(() => undefined);
  }
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => {
  console.error('auth API error', error.message);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
