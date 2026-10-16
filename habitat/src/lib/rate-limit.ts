import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { tooMany } from './errors';

/**
 * Fixed-window limiter backed by Postgres. Throws 429 once `limit` hits land in the same window.
 * Windows are aligned to `windowSeconds`, and stale rows are swept opportunistically.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, now = new Date()) {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const db = getDb();
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limit (key, window_start, count) values (${key}, ${windowStart.toISOString()}::timestamptz, 1)
    on conflict (key, window_start) do update set count = rate_limit.count + 1
    returning count`);
  if (Math.random() < 0.01) {
    const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);
    await db.execute(sql`delete from rate_limit where window_start < ${cutoff.toISOString()}::timestamptz`);
  }
  if ((rows[0]?.count ?? 1) > limit) throw tooMany();
}
