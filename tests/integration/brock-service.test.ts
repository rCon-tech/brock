import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { getToday, submitThrow } from '@/lib/brock-service';
import { DomainError } from '@/lib/errors';
import * as fairness from '@/lib/fairness';
import { utcDay } from '@/lib/day';
import type { Throw } from '@/lib/game';
import { createPlayer } from './setup';

const D1 = new Date('2026-11-01T10:00:00Z');
const D2 = new Date('2026-11-02T10:00:00Z');
const D3 = new Date('2026-11-03T10:00:00Z');
const D5 = new Date('2026-11-05T10:00:00Z');

const { brock, brockRound, player } = schema;

async function playerRow(userId: string) {
  const [row] = await getDb().select().from(player).where(eq(player.userId, userId));
  return row;
}

/**
 * Plays `mine` against the open round after fixing the House's throw to `house` (and re-committing
 * to it), so outcomes are deterministic even for rounds that were created earlier.
 */
async function play(userId: string, now: Date, mine: Throw, house: Throw) {
  const state = await getToday(userId, now);
  const open = state.openRound!;
  const [brockRow] = await getDb()
    .select()
    .from(brock)
    .where(and(eq(brock.userId, userId), eq(brock.day, utcDay(now))));
  const [row] = await getDb()
    .select()
    .from(brockRound)
    .where(and(eq(brockRound.brockId, brockRow.id), isNull(brockRound.playerThrow)));
  await getDb()
    .update(brockRound)
    .set({ houseThrow: house, commitHash: fairness.commit(house, row.salt) })
    .where(eq(brockRound.id, row.id));
  return submitThrow(userId, { roundNo: open.roundNo, throw: mine }, now);
}

/** The throw that beats each House throw. */
const BEATS_HOUSE: Record<Throw, Throw> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

describe('getToday', () => {
  it('creates today’s Brock with one committed round', async () => {
    const userId = await createPlayer('rich');
    const state = await getToday(userId, D1);

    expect(state).toMatchObject({
      day: '2026-11-01',
      brockNumber: 1,
      status: 'pending',
      streak: { current: 0, best: 0 },
      rounds: [],
    });
    expect(state.openRound).toEqual({
      roundNo: 1,
      commitHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(state.msUntilReset).toBe(14 * 3600_000);
  });

  it('is idempotent: calling it twice creates one Brock and one round', async () => {
    const userId = await createPlayer('rich');
    const a = await getToday(userId, D1);
    const b = await getToday(userId, D1);

    expect(b.openRound).toEqual(a.openRound);
    expect(await getDb().select().from(brock)).toHaveLength(1);
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('is safe under concurrent calls: still exactly one round', async () => {
    const userId = await createPlayer('rich');
    const states = await Promise.all(Array.from({ length: 10 }, () => getToday(userId, D1)));

    expect(new Set(states.map((s) => s.openRound!.commitHash)).size).toBe(1);
    expect(await getDb().select().from(brock)).toHaveLength(1);
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('gives each day its own Brock', async () => {
    const userId = await createPlayer('rich');
    const a = await getToday(userId, D1);
    const b = await getToday(userId, D2);

    expect(b.brockNumber).toBe(2);
    expect(b.openRound!.commitHash).not.toBe(a.openRound!.commitHash);
    expect(await getDb().select().from(brock)).toHaveLength(2);
  });

  it('rejects a user who has not chosen a handle', async () => {
    await expect(getToday('nobody', D1)).rejects.toMatchObject({ code: 'onboarding_required' });
  });
});

describe('house throw secrecy', () => {
  it('never exposes the open round’s throw or salt', async () => {
    const userId = await createPlayer('rich');
    const state = await getToday(userId, D1);
    const [row] = await getDb().select().from(brockRound);

    expect(Object.keys(state.openRound!).sort()).toEqual(['commitHash', 'roundNo']);
    const json = JSON.stringify(state);
    expect(json).not.toContain(row.salt);
    expect(json).not.toContain('houseThrow');
  });

  it('reveals throw and salt only after the player throws, and the hash verifies', async () => {
    const userId = await createPlayer('rich');
    const before = await getToday(userId, D1);
    const [row] = await getDb().select().from(brockRound);

    const result = await play(userId, D1, 'rock', row.houseThrow);
    expect(result.round).toMatchObject({ roundNo: 1, house: row.houseThrow, salt: row.salt });
    expect(result.round.commitHash).toBe(before.openRound!.commitHash);
    expect(fairness.verify(result.round.commitHash, result.round.house, result.round.salt)).toBe(
      true,
    );
  });
});

describe('submitThrow', () => {
  it('a draw opens a new round and keeps the Brock pending', async () => {
    const userId = await createPlayer('rich');
    const first = await getToday(userId, D1);
    const result = await play(userId, D1, 'rock', 'rock');

    expect(result.round).toMatchObject({ player: 'rock', house: 'rock', result: 'draw' });
    expect(result.status).toBe('pending');
    expect(result.rounds).toHaveLength(1);
    expect(result.openRound).toMatchObject({ roundNo: 2 });
    expect(result.openRound!.commitHash).not.toBe(first.openRound!.commitHash);
    expect(result.streak).toEqual({ current: 0, best: 0 });
    expect((await playerRow(userId)).totalWins).toBe(0);
  });

  it('a win decides the Brock and starts a streak', async () => {
    const userId = await createPlayer('rich');
    const result = await play(userId, D1, 'rock', 'scissors');

    expect(result.status).toBe('won');
    expect(result.openRound).toBeNull();
    expect(result.streak).toEqual({ current: 1, best: 1 });
    expect(await playerRow(userId)).toMatchObject({
      currentStreak: 1,
      bestStreak: 1,
      lastWinDay: '2026-11-01',
      totalWins: 1,
      totalLosses: 0,
    });
    const [b] = await getDb().select().from(brock);
    expect(b.status).toBe('won');
    expect(b.decidedAt).not.toBeNull();
  });

  it('a win the next day extends the streak', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'scissors');
    const result = await play(userId, D2, 'paper', 'rock');

    expect(result.streak).toEqual({ current: 2, best: 2 });
    expect((await playerRow(userId)).totalWins).toBe(2);
  });

  it('a draw then a win on the same day still adds just 1', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'rock');
    const result = await play(userId, D1, 'rock', 'scissors');

    expect(result.status).toBe('won');
    expect(result.rounds.map((r) => r.result)).toEqual(['draw', 'win']);
    expect(result.streak.current).toBe(1);
  });

  it('a loss resets the streak but keeps the best', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'scissors');
    await play(userId, D2, 'rock', 'scissors');
    const result = await play(userId, D3, 'rock', 'paper');

    expect(result.status).toBe('lost');
    expect(result.streak).toEqual({ current: 0, best: 2 });
    expect(await playerRow(userId)).toMatchObject({
      currentStreak: 0,
      bestStreak: 2,
      totalWins: 2,
      totalLosses: 1,
    });
  });

  it('a missed day lapses the streak, and the next win restarts at 1', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'scissors');
    await play(userId, D2, 'rock', 'scissors');

    // D3 skipped. By D5 the streak is no longer shown...
    expect((await getToday(userId, D5)).streak).toEqual({ current: 0, best: 2 });
    // ...and winning again starts over.
    const result = await play(userId, D5, 'rock', 'scissors');
    expect(result.streak).toEqual({ current: 1, best: 2 });
  });

  it('a streak is still shown the day after the last win', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'scissors');
    expect((await getToday(userId, D2)).streak.current).toBe(1);
  });

  it('rejects a second throw once the Brock is decided (already_played)', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'scissors');

    await expect(submitThrow(userId, { roundNo: 1, throw: 'rock' }, D1)).rejects.toMatchObject({
      code: 'already_played',
    });
    expect((await getToday(userId, D1)).status).toBe('won');
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('rejects the wrong round number (stale_round)', async () => {
    const userId = await createPlayer('rich');
    await getToday(userId, D1);

    await expect(submitThrow(userId, { roundNo: 2, throw: 'rock' }, D1)).rejects.toMatchObject({
      code: 'stale_round',
    });
  });

  it('rejects replaying a round that was already thrown (stale_round)', async () => {
    const userId = await createPlayer('rich');
    await play(userId, D1, 'rock', 'rock'); // draw, round 2 is now open

    await expect(submitThrow(userId, { roundNo: 1, throw: 'paper' }, D1)).rejects.toMatchObject({
      code: 'stale_round',
    });
  });

  it('rejects a throw when today’s Brock was never opened (new_day)', async () => {
    const userId = await createPlayer('rich');
    await getToday(userId, D1);

    await expect(submitThrow(userId, { roundNo: 1, throw: 'rock' }, D2)).rejects.toMatchObject({
      code: 'new_day',
    });
  });

  it('only counts one of 10 simultaneous throws on the same round', async () => {
    const userId = await createPlayer('rich');
    await getToday(userId, D1);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, () => submitThrow(userId, { roundNo: 1, throw: 'rock' }, D1)),
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(DomainError);
      expect(['already_played', 'stale_round']).toContain((r.reason as DomainError).code);
    }

    const rounds = await getDb().select().from(brockRound);
    expect(rounds.filter((r) => r.playerThrow !== null)).toHaveLength(1);
    const p = await playerRow(userId);
    expect(p.totalWins + p.totalLosses).toBeLessThanOrEqual(1);
  });

  it('works with the House’s real random throw: beating it always wins', async () => {
    const userId = await createPlayer('rich');
    const state = await getToday(userId, D1);
    const [row] = await getDb().select().from(brockRound);

    const result = await submitThrow(
      userId,
      { roundNo: state.openRound!.roundNo, throw: BEATS_HOUSE[row.houseThrow] },
      D1,
    );
    expect(result.status).toBe('won');
    expect(result.round.result).toBe('win');
  });
});
