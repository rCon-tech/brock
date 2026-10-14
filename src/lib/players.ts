import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Player } from '@/db/schema';
import { addDays, type Day } from './day';
import { DomainError } from './errors';
import { HandleInput } from './validation';

const { player, brock } = schema;

export async function getPlayerByUserId(userId: string): Promise<Player | null> {
  const [row] = await getDb().select().from(player).where(eq(player.userId, userId)).limit(1);
  return row ?? null;
}

export async function getPlayerByHandle(handle: string): Promise<Player | null> {
  const [row] = await getDb()
    .select()
    .from(player)
    .where(sql`lower(${player.handle}) = lower(${handle})`)
    .limit(1);
  return row ?? null;
}

function pgError(err: unknown): { code?: string; constraint_name?: string } {
  const e = err as { code?: string; constraint_name?: string; cause?: unknown };
  return e?.cause ? pgError(e.cause) : (e ?? {});
}

/** Creates the player row for a freshly signed-in user. */
export async function claimHandle(userId: string, rawHandle: string): Promise<Player> {
  const parsed = HandleInput.safeParse(rawHandle);
  if (!parsed.success) {
    throw new DomainError('invalid_request', parsed.error.issues[0]?.message);
  }
  try {
    const [row] = await getDb().insert(player).values({ userId, handle: parsed.data }).returning();
    return row;
  } catch (err) {
    const { code, constraint_name } = pgError(err);
    if (code === '23505') {
      if (constraint_name === 'player_pkey') throw new DomainError('already_onboarded');
      throw new DomainError('handle_taken', 'Handle taken');
    }
    throw err;
  }
}

export type ProfileDay = { day: Day; status: 'won' | 'lost' | 'pending' | null };

export interface Profile {
  player: Player;
  /** Oldest first, one entry per day for the 30 days ending `today`. */
  days: ProfileDay[];
}

export async function getProfile(handle: string, today: Day): Promise<Profile | null> {
  const found = await getPlayerByHandle(handle);
  if (!found) return null;

  const since = addDays(today, -29);
  const rows = await getDb()
    .select({ day: brock.day, status: brock.status })
    .from(brock)
    .where(and(eq(brock.userId, found.userId), gte(brock.day, since)))
    .orderBy(asc(brock.day));
  const byDay = new Map(rows.map((r) => [r.day, r.status]));

  const days: ProfileDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = addDays(today, -i);
    days.push({ day, status: byDay.get(day) ?? null });
  }
  return { player: found, days };
}
