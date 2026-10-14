import { and, asc, eq, gte, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Player } from '@/db/schema';
import { addDays, type Day } from './day';
import { DomainError } from './errors';
import {
  hashRecoveryCode,
  hashToken,
  isWellFormedRecoveryCode,
  newRecoveryCode,
  newToken,
  normalizeRecoveryCode,
  sameHash,
} from './identity';
import { allow } from './rate-limit';
import { HandleInput } from './validation';

const { player, brock } = schema;

const RECOVERY_ATTEMPTS = 5;
const RECOVERY_WINDOW_MS = 15 * 60_000;

export async function createAnonymousPlayer(tokenHash: string): Promise<Player> {
  const [row] = await getDb().insert(player).values({ tokenHash }).returning();
  return row;
}

export async function getPlayerByToken(token: string): Promise<Player | null> {
  const [row] = await getDb()
    .select()
    .from(player)
    .where(eq(player.tokenHash, hashToken(token)))
    .limit(1);
  return row ?? null;
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
 * Names an anonymous player. Allowed once, and only after they've finished a Brock, so a name
 * can't be squatted by something that never played. Returns the one-time recovery code.
 */
export async function claimHandle(
  playerId: string,
  rawHandle: string,
): Promise<{ player: Player; recoveryCode: string }> {
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

  const recoveryCode = newRecoveryCode();
  try {
    const [row] = await getDb()
      .update(player)
      .set({ handle: parsed.data, recoveryHash: hashRecoveryCode(recoveryCode) })
      // Guards a concurrent double-submit: only an unnamed player can be named.
      .where(and(eq(player.id, playerId), sql`${player.handle} IS NULL`))
      .returning();
    if (!row) throw new DomainError('already_named');
    return { player: row, recoveryCode };
  } catch (err) {
    if (pgError(err).code === '23505') throw new DomainError('handle_taken', 'Handle taken');
    throw err;
  }
}

/**
 * Restores a named player on a new browser. The code is single-use: success rotates both the
 * browser token (the old device is signed out) and the recovery code.
 * Wrong handle and wrong code are indistinguishable to the caller.
 */
export async function recoverPlayer(
  rawHandle: string,
  rawCode: string,
): Promise<{ player: Player; token: string; recoveryCode: string }> {
  const handle = rawHandle.trim().toLowerCase();
  if (!allow(`recover:${handle}`, RECOVERY_ATTEMPTS, RECOVERY_WINDOW_MS)) {
    throw new DomainError('rate_limited');
  }

  const found = await getPlayerByHandle(handle);
  const normalized = normalizeRecoveryCode(rawCode);
  const supplied = hashRecoveryCode(normalized);
  // Compare even when there's no match so timing doesn't reveal whether the handle exists.
  const valid =
    isWellFormedRecoveryCode(normalized) && sameHash(found?.recoveryHash ?? '00', supplied);
  if (!found || !valid) throw new DomainError('invalid_recovery');

  const token = newToken();
  const recoveryCode = newRecoveryCode();
  const [row] = await getDb()
    .update(player)
    .set({ tokenHash: hashToken(token), recoveryHash: hashRecoveryCode(recoveryCode) })
    // Re-check the old code in the write so two simultaneous recoveries can't both succeed.
    .where(and(eq(player.id, found.id), eq(player.recoveryHash, supplied)))
    .returning();
  if (!row) throw new DomainError('invalid_recovery');
  return { player: row, token, recoveryCode };
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
    .where(and(eq(brock.playerId, found.id), gte(brock.day, since)))
    .orderBy(asc(brock.day));
  const byDay = new Map(rows.map((r) => [r.day, r.status]));

  const days: ProfileDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = addDays(today, -i);
    days.push({ day, status: byDay.get(day) ?? null });
  }
  return { player: found, days };
}
