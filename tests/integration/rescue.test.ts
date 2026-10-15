import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { answerRescue, getToday, startRescue, submitThrow } from '@/lib/brock-service';
import { utcDay } from '@/lib/day';
import { commit } from '@/lib/fairness';
import type { Throw } from '@/lib/game';
import { RESCUE_GRACE_MS, RESCUE_SECONDS } from '@/lib/trivia/rescue';
import { createPlayer } from './setup';

const { brock, brockRescue, brockRound, player } = schema;

const at = (day: string, time = '10:00:00') => new Date(`${day}T${time}Z`);
const D1 = '2026-11-01';
const D2 = '2026-11-02';
const D3 = '2026-11-03';
const LOSES_TO: Record<Throw, Throw> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
const BEATEN_BY: Record<Throw, Throw> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

/** Plays the open round with the House's throw forced, so the outcome is certain. */
async function play(playerId: string, now: Date, mine: Throw, house: Throw) {
  const state = await getToday(playerId, now);
  const [today] = await getDb()
    .select()
    .from(brock)
    .where(and(eq(brock.playerId, playerId), eq(brock.day, utcDay(now))));
  const [open] = await getDb()
    .select()
    .from(brockRound)
    .where(and(eq(brockRound.brockId, today.id), isNull(brockRound.playerThrow)));
  await getDb()
    .update(brockRound)
    .set({ houseThrow: house, commitHash: commit(house, open.salt) })
    .where(eq(brockRound.id, open.id));
  return submitThrow(playerId, { roundNo: state.openRound!.roundNo, throw: mine }, now);
}
const win = (id: string, now: Date) => play(id, now, 'rock', BEATEN_BY.rock);
const lose = (id: string, now: Date) => play(id, now, 'rock', LOSES_TO.rock);

async function rescueRow(playerId: string, day: string) {
  const [row] = await getDb()
    .select({ rescue: brockRescue })
    .from(brockRescue)
    .innerJoin(brock, eq(brock.id, brockRescue.brockId))
    .where(and(eq(brock.playerId, playerId), eq(brock.day, day)));
  return row?.rescue ?? null;
}

async function playerRow(id: string) {
  const [row] = await getDb().select().from(player).where(eq(player.id, id));
  return row;
}

/** A player who won D1 and has just lost D2, so a lifeline is on offer. */
async function onStreakThenLost() {
  const id = await createPlayer('rich');
  await win(id, at(D1));
  const lost = await lose(id, at(D2));
  return { id, lost };
}

describe('when a lifeline is offered', () => {
  it('offers one after losing a live streak, remembering the streak', async () => {
    const { lost } = await onStreakThenLost();
    expect(lost.status).toBe('lost');
    expect(lost.streak.current).toBe(0);
    expect(lost.rescue).toEqual({ status: 'offered', streakBefore: 1 });
  });

  it('offers nothing when there was no streak to lose', async () => {
    const id = await createPlayer('rich');
    expect((await lose(id, at(D1))).rescue).toBeNull();
  });

  it('offers nothing when the streak had already lapsed (a missed day)', async () => {
    const id = await createPlayer('rich');
    await win(id, at(D1));
    expect((await lose(id, at(D3))).rescue).toBeNull();
  });

  it('offers nothing on a win or a draw', async () => {
    const id = await createPlayer('rich');
    await win(id, at(D1));
    const draw = await play(id, at(D2), 'rock', 'rock');
    expect(draw.rescue).toBeNull();
    expect((await win(id, at(D2))).rescue).toBeNull();
  });

  it('shows on a later visit the same day', async () => {
    const { id } = await onStreakThenLost();
    expect((await getToday(id, at(D2, '18:00:00'))).rescue).toEqual({
      status: 'offered',
      streakBefore: 1,
    });
  });
});

describe('startRescue', () => {
  it('asks a question with four options and a 15-second clock, never revealing the answer', async () => {
    const { id } = await onStreakThenLost();
    const state = await startRescue(id, at(D2, '10:01:00'));

    expect(state.rescue).toMatchObject({ status: 'asked', streakBefore: 1, msLeft: 15_000 });
    if (state.rescue?.status !== 'asked') throw new Error('not asked');
    expect(state.rescue.question).toMatch(/\?$/);
    expect(state.rescue.options).toHaveLength(4);

    const json = JSON.stringify(state);
    expect(json).not.toMatch(/answerIndex|correctIndex/);
  });

  it('cannot be rerolled: asking again returns the same question with less time', async () => {
    const { id } = await onStreakThenLost();
    const first = await startRescue(id, at(D2, '10:01:00'));
    const again = await startRescue(id, at(D2, '10:01:06'));

    expect(again.rescue).toMatchObject({ status: 'asked', msLeft: 9_000 });
    if (first.rescue?.status !== 'asked' || again.rescue?.status !== 'asked') throw new Error();
    expect(again.rescue.question).toBe(first.rescue.question);
    expect(again.rescue.options).toEqual(first.rescue.options);
  });

  it('refuses when there is no lifeline today', async () => {
    const id = await createPlayer('rich');
    await lose(id, at(D1));
    await expect(startRescue(id, at(D1))).rejects.toMatchObject({ code: 'no_rescue' });
  });

  it('never repeats a question the player has already had', async () => {
    const id = await createPlayer('rich');
    const seen = new Set<string>();
    // Win, lose, use the lifeline (wrongly) — three times over, on different days.
    for (const [w, l] of [
      ['2026-11-01', '2026-11-02'],
      ['2026-11-03', '2026-11-04'],
      ['2026-11-05', '2026-11-06'],
    ]) {
      await win(id, at(w));
      await lose(id, at(l));
      await startRescue(id, at(l, '10:01:00'));
      const row = await rescueRow(id, l);
      expect(seen.has(row!.questionId!)).toBe(false);
      seen.add(row!.questionId!);
      await answerRescue(id, null, at(l, '10:01:05'));
    }
  });
});

describe('answerRescue', () => {
  it('a right answer in time restores the streak and reopens the Brock', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    const row = await rescueRow(id, D2);

    const result = await answerRescue(id, row!.answerIndex, at(D2, '10:01:10'));
    expect(result.correct).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.streak.current).toBe(1);
    expect(result.openRound).not.toBeNull();
    expect(result.rescue).toMatchObject({
      status: 'passed',
      correctIndex: row!.answerIndex,
      chosenIndex: row!.answerIndex,
    });
  });

  it('then winning the second go continues the streak', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    await answerRescue(id, (await rescueRow(id, D2))!.answerIndex, at(D2, '10:01:05'));

    const second = await win(id, at(D2, '10:02:00'));
    expect(second.status).toBe('won');
    expect(second.streak).toEqual({ current: 2, best: 2 });
    expect(await playerRow(id)).toMatchObject({ currentStreak: 2, lastWinDay: D2, totalWins: 2 });
  });

  it('but losing the second go ends the streak, with no second lifeline', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    await answerRescue(id, (await rescueRow(id, D2))!.answerIndex, at(D2, '10:01:05'));

    const second = await lose(id, at(D2, '10:02:00'));
    expect(second.status).toBe('lost');
    expect(second.streak.current).toBe(0);
    expect(second.rescue?.status).toBe('passed');
    await expect(startRescue(id, at(D2, '10:03:00'))).resolves.toMatchObject({
      rescue: { status: 'passed' },
    });
    await expect(answerRescue(id, 0, at(D2, '10:03:00'))).rejects.toMatchObject({
      code: 'rescue_closed',
    });
  });

  it('a wrong answer keeps the loss and reveals the right one', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    const answer = (await rescueRow(id, D2))!.answerIndex!;
    const wrong = (answer + 1) % 4;

    const result = await answerRescue(id, wrong, at(D2, '10:01:04'));
    expect(result.correct).toBe(false);
    expect(result.status).toBe('lost');
    expect(result.streak.current).toBe(0);
    expect(result.openRound).toBeNull();
    expect(result.rescue).toMatchObject({
      status: 'failed',
      correctIndex: answer,
      chosenIndex: wrong,
    });
  });

  it('running out of time (no answer) keeps the loss', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    const result = await answerRescue(id, null, at(D2, '10:01:15'));
    expect(result.correct).toBe(false);
    expect(result.rescue).toMatchObject({ status: 'failed', chosenIndex: null });
  });

  it('a right answer that arrives after the clock (plus grace) does not count', async () => {
    const { id } = await onStreakThenLost();
    const asked = at(D2, '10:01:00');
    await startRescue(id, asked);
    const late = new Date(asked.getTime() + RESCUE_SECONDS * 1000 + RESCUE_GRACE_MS + 1);
    const result = await answerRescue(id, (await rescueRow(id, D2))!.answerIndex, late);
    expect(result.correct).toBe(false);
    expect(result.status).toBe('lost');
  });

  it('a right answer just inside the grace period still counts', async () => {
    const { id } = await onStreakThenLost();
    const asked = at(D2, '10:01:00');
    await startRescue(id, asked);
    const justInTime = new Date(asked.getTime() + RESCUE_SECONDS * 1000 + RESCUE_GRACE_MS);
    const result = await answerRescue(id, (await rescueRow(id, D2))!.answerIndex, justInTime);
    expect(result.correct).toBe(true);
  });

  it('an abandoned question is closed as failed on the next visit', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    const later = await getToday(id, at(D2, '12:00:00'));
    expect(later.rescue?.status).toBe('failed');
    expect((await rescueRow(id, D2))!.status).toBe('failed');
  });

  it('cannot be answered before the question is shown, or twice', async () => {
    const { id } = await onStreakThenLost();
    await expect(answerRescue(id, 0, at(D2, '10:01:00'))).rejects.toMatchObject({
      code: 'rescue_closed',
    });
    await startRescue(id, at(D2, '10:01:00'));
    await answerRescue(id, 0, at(D2, '10:01:03'));
    await expect(answerRescue(id, 1, at(D2, '10:01:04'))).rejects.toMatchObject({
      code: 'rescue_closed',
    });
  });

  it('counts only one of several simultaneous answers', async () => {
    const { id } = await onStreakThenLost();
    await startRescue(id, at(D2, '10:01:00'));
    const answer = (await rescueRow(id, D2))!.answerIndex!;

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => answerRescue(id, answer, at(D2, '10:01:05'))),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rounds = await getDb()
      .select()
      .from(brockRound)
      .innerJoin(brock, eq(brock.id, brockRound.brockId))
      .where(and(eq(brock.playerId, id), eq(brock.day, D2), isNull(brockRound.playerThrow)));
    expect(rounds).toHaveLength(1);
  });
});
