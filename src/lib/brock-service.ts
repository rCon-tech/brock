import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema, type Db, type Tx } from '@/db';
import type { BrockRoundRow, Player } from '@/db/schema';
import { brockNumber, msUntilReset, utcDay, type Day } from './day';
import { DomainError } from './errors';
import { commit, houseThrow, newSalt } from './fairness';
import { resolveRound, type RoundResult, type Throw } from './game';
import { applyLoss, applyWin, effectiveStreak } from './streak';

const { brock, brockRound, player } = schema;

export type BrockStatus = 'pending' | 'won' | 'lost';

/** A round the player has thrown in. Only these ever expose the House's throw and salt. */
export interface RevealedRound {
  roundNo: number;
  player: Throw;
  house: Throw;
  salt: string;
  commitHash: string;
  result: RoundResult;
}

/** The round awaiting the player's throw. The House's throw and salt stay on the server. */
export interface OpenRound {
  roundNo: number;
  commitHash: string;
}

export interface TodayState {
  day: Day;
  brockNumber: number;
  /** Null until the player names themselves after a finished Brock. */
  handle: string | null;
  status: BrockStatus;
  streak: { current: number; best: number };
  rounds: RevealedRound[];
  openRound: OpenRound | null;
  msUntilReset: number;
}

export interface ThrowResult extends TodayState {
  /** The round that was just thrown, now revealed. */
  round: RevealedRound;
}

function toRevealed(row: BrockRoundRow): RevealedRound {
  if (!row.playerThrow || !row.result) throw new Error('Round is not revealed yet');
  return {
    roundNo: row.roundNo,
    player: row.playerThrow,
    house: row.houseThrow,
    salt: row.salt,
    commitHash: row.commitHash,
    result: row.result,
  };
}

function freshRound(brockId: string, roundNo: number) {
  const house = houseThrow();
  const salt = newSalt();
  return { brockId, roundNo, houseThrow: house, salt, commitHash: commit(house, salt) };
}

async function loadRounds(tx: Tx, brockId: string): Promise<BrockRoundRow[]> {
  return tx
    .select()
    .from(brockRound)
    .where(eq(brockRound.brockId, brockId))
    .orderBy(asc(brockRound.roundNo));
}

/** Builds the client-safe view. This is the only place round rows become API output. */
function buildState(
  now: Date,
  day: Day,
  status: BrockStatus,
  playerRow: Player,
  rounds: BrockRoundRow[],
): TodayState {
  const revealed = rounds.filter((r) => r.playerThrow !== null).map(toRevealed);
  const open = rounds.find((r) => r.playerThrow === null);
  return {
    day,
    brockNumber: brockNumber(day),
    handle: playerRow.handle,
    status,
    streak: { current: effectiveStreak(playerRow, day), best: playerRow.bestStreak },
    rounds: revealed,
    openRound:
      status === 'pending' && open ? { roundNo: open.roundNo, commitHash: open.commitHash } : null,
    msUntilReset: msUntilReset(now),
  };
}

async function loadPlayer(tx: Tx, playerId: string, lock: boolean): Promise<Player> {
  const query = tx.select().from(player).where(eq(player.id, playerId)).limit(1);
  const [row] = await (lock ? query.for('update') : query);
  if (!row) throw new DomainError('unauthorized');
  return row;
}

/**
 * Today's Brock for a player. Idempotent: the first call creates the Brock and the first
 * round (committing to the House's throw); later calls return the same state.
 */
export async function getToday(
  playerId: string,
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<TodayState> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    const playerRow = await loadPlayer(tx, playerId, false);

    await tx.insert(brock).values({ playerId, day }).onConflictDoNothing();
    const [today] = await tx
      .select()
      .from(brock)
      .where(and(eq(brock.playerId, playerId), eq(brock.day, day)))
      .for('update');

    let rounds = await loadRounds(tx, today.id);
    if (today.status === 'pending' && !rounds.some((r) => r.playerThrow === null)) {
      const [created] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, rounds.length + 1))
        .returning();
      rounds = [...rounds, created];
    }

    return buildState(now, day, today.status, playerRow, rounds);
  });
}

/**
 * Resolves the open round. A draw opens a new round; a win or loss decides the day's Brock
 * and updates the player's streak. Everything happens under a row lock on today's Brock,
 * so concurrent submissions can't both succeed.
 */
export async function submitThrow(
  playerId: string,
  input: { roundNo: number; throw: Throw },
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<ThrowResult> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    const [today] = await tx
      .select()
      .from(brock)
      .where(and(eq(brock.playerId, playerId), eq(brock.day, day)))
      .for('update');

    if (!today) throw new DomainError('new_day');
    if (today.status !== 'pending') throw new DomainError('already_played');

    const rounds = await loadRounds(tx, today.id);
    const open = rounds.find((r) => r.playerThrow === null);
    if (!open || open.roundNo !== input.roundNo) throw new DomainError('stale_round');

    const result = resolveRound(input.throw, open.houseThrow);
    const [revealedRow] = await tx
      .update(brockRound)
      .set({ playerThrow: input.throw, result, revealedAt: now })
      .where(eq(brockRound.id, open.id))
      .returning();

    let status: BrockStatus = 'pending';
    let allRounds = rounds.map((r) => (r.id === revealedRow.id ? revealedRow : r));
    let playerRow = await loadPlayer(tx, playerId, true);

    if (result === 'draw') {
      const [next] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, open.roundNo + 1))
        .returning();
      allRounds = [...allRounds, next];
    } else if (result === 'win') {
      status = 'won';
      const streak = applyWin(playerRow, day);
      [playerRow] = await tx
        .update(player)
        .set({ ...streak, totalWins: playerRow.totalWins + 1 })
        .where(eq(player.id, playerId))
        .returning();
    } else {
      status = 'lost';
      const streak = applyLoss(playerRow);
      [playerRow] = await tx
        .update(player)
        .set({ ...streak, totalLosses: playerRow.totalLosses + 1 })
        .where(eq(player.id, playerId))
        .returning();
    }

    if (status !== 'pending') {
      await tx.update(brock).set({ status, decidedAt: now }).where(eq(brock.id, today.id));
    }

    return {
      ...buildState(now, day, status, playerRow, allRounds),
      round: toRevealed(revealedRow),
    };
  });
}
