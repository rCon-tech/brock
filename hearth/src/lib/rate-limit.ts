import { sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { rowsOf } from '@/lib/db-util';
import { RateLimited } from '@/lib/errors';

/**
 * Fixed-window limiter backed by Postgres, so it holds across serverless instances (R36).
 * Returns true if the call is allowed.
 */
export async function allow(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const result = await db.execute(sql`
    insert into rate_limit (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limit.window_start < now() - (${windowMs} * interval '1 millisecond')
                   then 1 else rate_limit.count + 1 end,
      window_start = case when rate_limit.window_start < now() - (${windowMs} * interval '1 millisecond')
                          then now() else rate_limit.window_start end
    returning count`);
  const [row] = rowsOf<{ count: number | string }>(result);
  return Number(row.count) <= limit;
}

export async function enforce(db: Db, key: string, limit: number, windowMs: number): Promise<void> {
  if (!(await allow(db, key, limit, windowMs))) throw new RateLimited();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The limits from R36, in one place. */
export const LIMITS = {
  createProject: { limit: 10, windowMs: DAY },
  join: { limit: 20, windowMs: HOUR },
  swipes: { limit: 120, windowMs: MINUTE },
  go: { limit: 60, windowMs: MINUTE },
  reactions: { limit: 60, windowMs: MINUTE },
} as const;
