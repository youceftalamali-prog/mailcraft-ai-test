import type { Pool, PoolClient } from 'pg';

export type Plan = 'free' | 'pro' | 'business';
export type UsageAction = 'campaign' | 'image' | 'voice';

export const PLAN_LIMITS: Record<Plan, Record<UsageAction, number>> = {
  free: { campaign: 10, image: 10, voice: 20 },
  pro: { campaign: 250, image: 150, voice: 300 },
  business: { campaign: 1500, image: 1000, voice: 2000 },
};

export class UsageLimitError extends Error {
  constructor(readonly plan: Plan, readonly action: UsageAction, readonly limit: number) {
    super(`Monthly ${action} limit reached for the ${plan} plan.`);
    this.name = 'UsageLimitError';
  }
}

/**
 * Atomically reserve one generation unit for the authenticated account.
 * Call only from trusted server code after resolving the session from the
 * HttpOnly cookie. Never accept userId, plan, or action limits from the client.
 *
 * This helper is not yet wired into the existing Gemini routes because those
 * routes live in the protected legacy server.ts and need a separately tested
 * integration plan that preserves all current request/response behavior.
 */
export async function consumeUsage(
  db: Pool | PoolClient,
  userId: string,
  action: UsageAction,
): Promise<{ plan: Plan; used: number; limit: number }> {
  const userResult = await db.query(
    `SELECT plan FROM app_users WHERE id = $1 AND status = 'active' LIMIT 1`,
    [userId],
  );
  const plan = userResult.rows[0]?.plan as Plan | undefined;
  if (!plan || !(plan in PLAN_LIMITS)) throw new Error('Active account required.');

  const limit = PLAN_LIMITS[plan][action];
  const column = action === 'campaign' ? 'campaigns_count' : action === 'image' ? 'images_count' : 'voice_count';

  // Row-level lock ensures concurrent requests cannot overshoot a plan limit.
  const client = 'connect' in db && typeof db.connect === 'function' ? await db.connect() : null;
  const executor = client ?? db;
  try {
    await executor.query('BEGIN');
    const usage = await executor.query(
      `INSERT INTO app_usage (user_id, period_start) VALUES ($1, date_trunc('month', now())::date)
       ON CONFLICT (user_id, period_start) DO NOTHING`,
      [userId],
    );
    void usage;
    const locked = await executor.query(
      `SELECT ${column} AS used FROM app_usage
       WHERE user_id = $1 AND period_start = date_trunc('month', now())::date
       FOR UPDATE`,
      [userId],
    );
    const used = Number(locked.rows[0]?.used ?? 0);
    if (used >= limit) {
      await executor.query('ROLLBACK');
      throw new UsageLimitError(plan, action, limit);
    }
    const updated = await executor.query(
      `UPDATE app_usage SET ${column} = ${column} + 1
       WHERE user_id = $1 AND period_start = date_trunc('month', now())::date
       RETURNING ${column} AS used`,
      [userId],
    );
    await executor.query('COMMIT');
    return { plan, used: Number(updated.rows[0]?.used ?? used + 1), limit };
  } catch (error) {
    await executor.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client?.release();
  }
}
