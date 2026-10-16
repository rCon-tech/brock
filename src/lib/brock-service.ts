import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema, type Db, type Tx } from '@/db';
import type { BrockQuizRow, BrockRoundRow, BrockRow, Player, QuizItem } from '@/db/schema';
import { brockNumber, msUntilReset, utcDay, type Day } from './day';
import { DomainError } from './errors';
import { commit, houseThrow, newSalt } from './fairness';
import { resolveRound, type RoundResult, type Throw } from './game';
import {
  correctCount,
  currentExpired,
  pickQuiz,
  questionDeadline,
  quizView,
  toItems,
  QUIZ_GRACE_MS,
  type QuizView,
} from './trivia/quiz';

const { brock, brockQuiz, brockRound, player } = schema;

/** `playing`: today's run is still going. `over`: the run has ended (a life from the quiz can revive it). */
export type RunStatus = 'playing' | 'over';

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
  /** Null until the player names themselves after their first finished run. */
  handle: string | null;
  status: RunStatus;
  /** Brocks won in today's run. */
  score: number;
  /** The player's best run ever. */
  best: number;
  rounds: RevealedRound[];
  openRound: OpenRound | null;
  msUntilReset: number;
  /** Today's "win another life" quiz, once started. */
  quiz: QuizView | null;
  /** True when the run is over and today's quiz hasn't been tried yet. */
  quizAvailable: boolean;
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

/** Builds the client-safe view. This is the only place round and quiz rows become API output. */
function buildState(
  now: Date,
  today: BrockRow,
  playerRow: Player,
  rounds: BrockRoundRow[],
  quiz: BrockQuizRow | null,
): TodayState {
  const playing = today.status === 'pending';
  const open = rounds.find((r) => r.playerThrow === null);
  return {
    day: today.day,
    brockNumber: brockNumber(today.day),
    handle: playerRow.handle,
    status: playing ? 'playing' : 'over',
    score: today.score,
    best: playerRow.bestScore,
    rounds: rounds.filter((r) => r.playerThrow !== null).map(toRevealed),
    openRound: playing && open ? { roundNo: open.roundNo, commitHash: open.commitHash } : null,
    msUntilReset: msUntilReset(now),
    quiz: quizView(quiz, now),
    // Runs that ended under the old one-Brock rules ('won') don't get a quiz.
    quizAvailable: today.status === 'lost' && quiz === null,
  };
}

async function loadPlayer(tx: Tx, playerId: string, lock: boolean): Promise<Player> {
  const query = tx.select().from(player).where(eq(player.id, playerId)).limit(1);
  const [row] = await (lock ? query.for('update') : query);
  if (!row) throw new DomainError('unauthorized');
  return row;
}

async function lockToday(tx: Tx, playerId: string, day: Day): Promise<BrockRow> {
  const [today] = await tx
    .select()
    .from(brock)
    .where(and(eq(brock.playerId, playerId), eq(brock.day, day)))
    .for('update');
  if (!today) throw new DomainError('new_day');
  return today;
}

/**
 * Records an answer to the current question (null: the clock ran out) and moves on. The next
 * question's clock starts now. After the last question the quiz is marked passed or failed.
 */
function answered(row: BrockQuizRow, choice: number | null, now: Date) {
  const items: QuizItem[] = row.items.map((item, i) =>
    i === row.currentIndex ? { ...item, chosenIndex: choice } : item,
  );
  const currentIndex = row.currentIndex + 1;
  if (currentIndex < items.length) {
    return { items, currentIndex, questionStartedAt: now };
  }
  const status = correctCount(items) === items.length ? ('passed' as const) : ('failed' as const);
  return { items, currentIndex, status, finishedAt: now };
}

/**
 * Today's quiz, first closing a question whose clock ran out while nobody was looking (it counts
 * as wrong). Only the question on screen has a running clock, so at most one can expire.
 * Expiring the last question can fail the quiz but never pass it, so the run stays over.
 */
async function loadQuiz(tx: Tx, brockId: string, now: Date): Promise<BrockQuizRow | null> {
  const [row] = await tx.select().from(brockQuiz).where(eq(brockQuiz.brockId, brockId));
  if (!row || !currentExpired(row, now)) return row ?? null;
  const [updated] = await tx
    .update(brockQuiz)
    .set(answered(row, null, now))
    .where(eq(brockQuiz.brockId, brockId))
    .returning();
  return updated;
}

/** Question ids from every quiz this player has taken, so new quizzes prefer unseen ones. */
async function seenQuestions(tx: Tx, playerId: string): Promise<string[]> {
  const rows = await tx
    .select({ items: brockQuiz.items })
    .from(brockQuiz)
    .innerJoin(brock, eq(brock.id, brockQuiz.brockId))
    .where(eq(brock.playerId, playerId));
  return rows.flatMap((r) => r.items.map((i) => i.questionId));
}

/**
 * Today's run for a player. Idempotent: the first call creates the run and its first round
 * (committing to the House's throw); later calls return the same state.
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
    const today = await lockToday(tx, playerId, day);

    let rounds = await loadRounds(tx, today.id);
    if (today.status === 'pending' && !rounds.some((r) => r.playerThrow === null)) {
      const [created] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, rounds.length + 1))
        .returning();
      rounds = [...rounds, created];
    }

    const quiz = await loadQuiz(tx, today.id, now);
    return buildState(now, today, playerRow, rounds, quiz);
  });
}

/**
 * Resolves the open round. A draw or a win opens the next round (a win also adds 1 to the run's
 * score); a loss ends the run. Everything happens under a row lock on today's run, so
 * concurrent submissions can't both succeed.
 */
export async function submitThrow(
  playerId: string,
  input: { roundNo: number; throw: Throw },
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<ThrowResult> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    let today = await lockToday(tx, playerId, day);
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

    let allRounds = rounds.map((r) => (r.id === revealedRow.id ? revealedRow : r));
    let playerRow = await loadPlayer(tx, playerId, true);

    if (result === 'loss') {
      [today] = await tx
        .update(brock)
        .set({ status: 'lost', decidedAt: now })
        .where(eq(brock.id, today.id))
        .returning();
      [playerRow] = await tx
        .update(player)
        .set({ totalLosses: playerRow.totalLosses + 1 })
        .where(eq(player.id, playerId))
        .returning();
    } else {
      if (result === 'win') {
        const score = today.score + 1;
        [today] = await tx.update(brock).set({ score }).where(eq(brock.id, today.id)).returning();
        [playerRow] = await tx
          .update(player)
          .set({
            totalWins: playerRow.totalWins + 1,
            bestScore: Math.max(playerRow.bestScore, score),
          })
          .where(eq(player.id, playerId))
          .returning();
      }
      const [next] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, open.roundNo + 1))
        .returning();
      allRounds = [...allRounds, next];
    }

    const quiz = await loadQuiz(tx, today.id, now);
    return {
      ...buildState(now, today, playerRow, allRounds, quiz),
      round: toRevealed(revealedRow),
    };
  });
}

/**
 * Starts today's quiz, or returns it where it stands. The questions are fixed when it starts,
 * and reloading shows the same question with the time that's left, so nothing can be rerolled.
 * One try per day: a finished quiz is never replaced.
 */
export async function startQuiz(
  playerId: string,
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<TodayState> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    const today = await lockToday(tx, playerId, day);
    let quiz = await loadQuiz(tx, today.id, now);

    if (!quiz) {
      if (today.status !== 'lost') throw new DomainError('no_quiz');
      const items = toItems(pickQuiz(await seenQuestions(tx, playerId)));
      [quiz] = await tx
        .insert(brockQuiz)
        .values({ brockId: today.id, items, currentIndex: 0, questionStartedAt: now })
        .returning();
    }

    const playerRow = await loadPlayer(tx, playerId, false);
    const rounds = await loadRounds(tx, today.id);
    return buildState(now, today, playerRow, rounds, quiz);
  });
}

/**
 * Answers question `index` of today's quiz (`choice` null means the clock ran out). Nothing says
 * right or wrong until all five are answered. Five out of five revives the run with its score
 * intact and a fresh, committed round.
 */
export async function answerQuiz(
  playerId: string,
  input: { index: number; choice: number | null },
  now: Date = new Date(),
  database: Db = getDb(),
): Promise<TodayState> {
  const day = utcDay(now);

  return database.transaction(async (tx) => {
    let today = await lockToday(tx, playerId, day);
    const [current] = await tx.select().from(brockQuiz).where(eq(brockQuiz.brockId, today.id));
    if (!current) throw new DomainError('no_quiz');
    if (current.status !== 'active') throw new DomainError('quiz_closed');
    if (input.index !== current.currentIndex) throw new DomainError('stale_question');

    const inTime = now.getTime() <= questionDeadline(current) + QUIZ_GRACE_MS;
    const choice = inTime ? input.choice : null;
    const [quiz] = await tx
      .update(brockQuiz)
      .set(answered(current, choice, now))
      .where(eq(brockQuiz.brockId, today.id))
      .returning();

    let rounds = await loadRounds(tx, today.id);
    if (quiz.status === 'passed') {
      [today] = await tx
        .update(brock)
        .set({ status: 'pending', decidedAt: null })
        .where(eq(brock.id, today.id))
        .returning();
      const [next] = await tx
        .insert(brockRound)
        .values(freshRound(today.id, rounds.length + 1))
        .returning();
      rounds = [...rounds, next];
    }

    const playerRow = await loadPlayer(tx, playerId, false);
    return buildState(now, today, playerRow, rounds, quiz);
  });
}
