import { and, asc, eq, gte, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Player } from '@/db/schema';
import { addDays, type Day } from './day';
import { DomainError } from './errors';
import { hashToken, newToken } from './identity';
import { HandleInput } from './validation';

const { player, playerSession, brock } = schema;

/** Creates an unnamed player and logs `token`'s browser in as them. */
export async function createAnonymousPlayer(tokenHash: string): Promise<Player> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.insert(player).values({}).returning();
    await tx.insert(playerSession).values({ tokenHash, playerId: row.id });
    return row;
  });
}

export async function getPlayerByToken(token: string): Promise<Player | null> {
  const [row] = await getDb()
    .select({ player })
    .from(playerSession)
    .innerJoin(player, eq(player.id, playerSession.playerId))
    .where(eq(playerSession.tokenHash, hashToken(token)))
    .limit(1);
  return row?.player ?? null;
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const [row] = await getDb().select().from(player).where(eq(player.id, id)).limit(1);
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

function pgError(err: unknown): { code?: string } {
  const e = err as { code?: string; cause?: unknown };
  return e?.cause ? pgError(e.cause) : (e ?? {});
}

/**
 * Names an anonymous player. Allowed once, and only after they've finished a run, so a name
 * can't be squatted by something that never played.
 */
export async function claimHandle(playerId: string, rawHandle: string): Promise<Player> {
  const parsed = HandleInput.safeParse(rawHandle);
  if (!parsed.success) {
    throw new DomainError('invalid_request', parsed.error.issues[0]?.message);
  }

  const me = await getPlayerById(playerId);
  if (!me) throw new DomainError('unauthorized');
  if (me.handle) throw new DomainError('already_named');

  const [decided] = await getDb()
    .select({ id: brock.id })
    .from(brock)
    .where(and(eq(brock.playerId, playerId), ne(brock.status, 'pending')))
    .limit(1);
  if (!decided) throw new DomainError('play_first');

  try {
    const [row] = await getDb()
      .update(player)
      .set({ handle: parsed.data })
      // Guards a concurrent double-submit: only an unnamed player can be named.
      .where(and(eq(player.id, playerId), sql`${player.handle} IS NULL`))
      .returning();
    if (!row) throw new DomainError('already_named');
    return row;
  } catch (err) {
    if (pgError(err).code === '23505') throw new DomainError('handle_taken', 'Handle taken');
    throw err;
  }
}

/**
 * Logs a browser in as the player with this handle, by name alone. Brock is a casual game, so
 * there's deliberately no password: anyone who knows a handle can play as it. Other devices
 * already logged in as that player stay logged in.
 */
export async function logInAs(rawHandle: string): Promise<{ player: Player; token: string }> {
  const found = await getPlayerByHandle(rawHandle.trim());
  if (!found) throw new DomainError('not_found');

  const token = newToken();
  await getDb()
    .insert(playerSession)
    .values({ tokenHash: hashToken(token), playerId: found.id });
  return { player: found, token };
}

/** One day of a player's history: their run's score, or null if they didn't play. */
export type ProfileDay = { day: Day; score: number | null; playing: boolean };

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
    .select({ day: brock.day, status: brock.status, score: brock.score })
    .from(brock)
    .where(and(eq(brock.playerId, found.id), gte(brock.day, since)))
    .orderBy(asc(brock.day));
  const byDay = new Map(rows.map((r) => [r.day, r]));

  const days: ProfileDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = addDays(today, -i);
    const row = byDay.get(day);
    days.push({ day, score: row?.score ?? null, playing: row?.status === 'pending' });
  }
  return { player: found, days };
}
