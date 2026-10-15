import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { getDb, schema, type Db, type Tx } from '@/db';
import type { BrockRescueRow, BrockRoundRow, Player } from '@/db/schema';
import { brockNumber, msUntilReset, utcDay, type Day } from './day';
import { DomainError } from './errors';
import { commit, houseThrow, newSalt } from './fairness';
import { resolveRound, type RoundResult, type Throw } from './game';
import { applyLoss, applyWin, effectiveStreak } from './streak';
import {
  isExpired,
  pickQuestion,
  rescueView,
  shuffledOptions,
  RESCUE_GRACE_MS,
  RESCUE_SECONDS,
  type RescueView,
} from './trivia/rescue';

const { brock, brockRescue, brockRound, player } = schema;

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
  /** Today's trivia lifeline, if a streak-ending loss earned one. */
  rescue: RescueView | null;
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
  rescue: BrockRescueRow | null,
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
    rescue: rescueView(rescue, now),
  };
}

async function loadPlayer(tx: Tx, playerId: string, lock: boolean): Promise<Player> {
  const query = tx.select().from(player).where(eq(player.id, playerId)).limit(1);
  const [row] = await (lock ? query.for('update') : query);
  if (!row) throw new DomainError('unauthorized');
  return row;
}

/** Today's rescue, closing it first if its clock ran out while nobody was looking. */
async function loadRescue(tx: Tx, brockId: string, now: Date): Promise<BrockRescueRow | null> {
  const [row] = await tx.select().from(brockRescue).where(eq(brockRescue.brockId, brockId));
  if (!row) return null;
  if (isExpired(row, now)) {
    const [failed] = await tx
      .update(brockRescue)
      .set({ status: 'failed', answeredAt: now })
      .where(eq(brockRescue.brockId, brockId))
      .returning();
    return failed;
  }
  return row;
}

async function lockToday(tx: Tx, playerId: string, day: Day) {
  const [today] = await tx
    .select()
    .from(brock)
    .where(and(eq(brock.playerId, playerId), eq(brock.day, day)))
    .for('update');
  if (!today) throw new DomainError('new_day');
  return today;
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

    const rescue = await loadRescue(tx, today.id, now);
    return buildState(now, day, today.status, playerRow, rounds, rescue);
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
    const streakBefore = effectiveStreak(playerRow, day);
    let rescue = await loadRescue(tx, today.id, now);

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
      // Losing a live streak earns one trivia lifeline per day. A second loss after using it
      // today (the rescue row already exists) ends the streak for good.
      if (streakBefore > 0 && !rescue) {
        [rescue] = await tx
          .insert(brockRescue)
          .values({ brockId: today.id, streakBefore })
          .returning();
      }
    }

    if (status !== 'pending') {
      await tx.update(brock).set({ status, decidedAt: now }).where(eq(brock.id, today.id));
    }

    return {
      ...buildState(now, day, status, playerRow, allRounds, rescue),
      round: toRevealed(revealedRow),
    };
  });
}

/**
 * Shows the lifeline question and starts its clock. Idempotent once asked: reloading returns the
 * same question with the time that's left, so nobody can reroll for an easier one.
 */
export async function startRescue(
  playerId: string,
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<TodayState> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    const today = await lockToday(tx, playerId, day);
    let rescue = await loadRescue(tx, today.id, now);
    if (!rescue) throw new DomainError('no_rescue');

    if (rescue.status === 'offered') {
      const seen = await tx
        .select({ id: brockRescue.questionId })
        .from(brockRescue)
        .innerJoin(brock, eq(brock.id, brockRescue.brockId))
        .where(and(eq(brock.playerId, playerId), isNotNull(brockRescue.questionId)));
      const question = pickQuestion(seen.map((r) => r.id!));
      const { options, answerIndex } = shuffledOptions(question);
      [rescue] = await tx
        .update(brockRescue)
        .set({ status: 'asked', questionId: question.id, options, answerIndex, askedAt: now })
        .where(eq(brockRescue.brockId, today.id))
        .returning();
    }

    const playerRow = await loadPlayer(tx, playerId, false);
    const rounds = await loadRounds(tx, today.id);
    return buildState(now, day, today.status, playerRow, rounds, rescue);
  });
}

/**
 * Answers the lifeline question (`choice` null means the clock ran out). Right, and in time:
 * the streak is restored and the Brock reopens for one more throw. Otherwise the loss stands.
 */
export async function answerRescue(
  playerId: string,
  choice: number | null,
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<TodayState & { correct: boolean }> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    const today = await lockToday(tx, playerId, day);
    const [rescue] = await tx.select().from(brockRescue).where(eq(brockRescue.brockId, today.id));
    if (!rescue) throw new DomainError('no_rescue');
    if (rescue.status !== 'asked') throw new DomainError('rescue_closed');

    const askedAt = rescue.askedAt?.getTime() ?? 0;
    const inTime = now.getTime() <= askedAt + RESCUE_SECONDS * 1000 + RESCUE_GRACE_MS;
    const correct = inTime && choice !== null && choice === rescue.answerIndex;

    const [answered] = await tx
      .update(brockRescue)
      .set({ status: correct ? 'passed' : 'failed', chosenIndex: choice, answeredAt: now })
      .where(eq(brockRescue.brockId, today.id))
      .returning();

    let status: BrockStatus = today.status;
    let playerRow = await loadPlayer(tx, playerId, true);
    let rounds = await loadRounds(tx, today.id);

    if (correct) {
      // Put the streak back and reopen today's Brock with a fresh, committed round.
      [playerRow] = await tx
        .update(player)
        .set({ currentStreak: rescue.streakBefore })
        .where(eq(player.id, playerId))
        .returning();
      status = 'pending';
      await tx.update(brock).set({ status, decidedAt: null }).where(eq(brock.id, today.id));
      const [next] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, rounds.length + 1))
        .returning();
      rounds = [...rounds, next];
    }

    return { ...buildState(now, day, status, playerRow, rounds, answered), correct };
  });
}
