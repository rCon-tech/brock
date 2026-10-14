import { describe, expect, it } from 'vitest';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { createPlayer, createPlayers } from './setup';

const TODAY = '2026-11-10';
const YESTERDAY = '2026-11-09';
const TWO_DAYS_AGO = '2026-11-08';

const streak = (current: number, best = current, lastWinDay = TODAY) => ({
  currentStreak: current,
  bestStreak: best,
  lastWinDay,
});

describe('topPlayers', () => {
  it('orders by current streak, then best streak, then handle', async () => {
    await createPlayer('zed', streak(5, 5));
    await createPlayer('amy', streak(5, 5));
    await createPlayer('bob', streak(5, 9));
    await createPlayer('cat', streak(7, 7));
    await createPlayer('dan', streak(1, 1));

    const board = await topPlayers(100, TODAY);
    expect(board.map((e) => e.handle)).toEqual(['cat', 'bob', 'amy', 'zed', 'dan']);
  });

  it('gives players tied on streak and best the same rank, and skips the next ranks', async () => {
    await createPlayer('amy', streak(5, 5));
    await createPlayer('zed', streak(5, 5));
    await createPlayer('bob', streak(5, 9));
    await createPlayer('cat', streak(7, 7));
    await createPlayer('dan', streak(1, 1));

    const board = await topPlayers(100, TODAY);
    expect(board.map((e) => [e.handle, e.rank])).toEqual([
      ['cat', 1],
      ['bob', 2],
      ['amy', 3],
      ['zed', 3],
      ['dan', 5],
    ]);
  });

  it('includes a streak whose last win was yesterday (still defendable)', async () => {
    await createPlayer('amy', streak(3, 3, YESTERDAY));
    expect((await topPlayers(100, TODAY)).map((e) => e.handle)).toEqual(['amy']);
  });

  it('leaves out lapsed streaks (last win 2+ days ago), players on 0, and players who never won', async () => {
    await createPlayer('lapsed', streak(9, 9, TWO_DAYS_AGO));
    await createPlayer('lost', { currentStreak: 0, bestStreak: 4, lastWinDay: TODAY });
    await createPlayer('newbie');
    await createPlayer('active', streak(2));

    expect((await topPlayers(100, TODAY)).map((e) => e.handle)).toEqual(['active']);
  });

  it('leaves out players who never chose a handle, even with a streak', async () => {
    await createPlayer(null, streak(9));
    await createPlayer('named', streak(1));

    expect((await topPlayers(100, TODAY)).map((e) => e.handle)).toEqual(['named']);
  });

  it('is empty when nobody has a streak', async () => {
    expect(await topPlayers(100, TODAY)).toEqual([]);
  });

  it('clamps the limit to 1–100', async () => {
    await createPlayers(105, streak(3));

    expect(await topPlayers(1000, TODAY)).toHaveLength(100);
    expect(await topPlayers(0, TODAY)).toHaveLength(1);
    expect(await topPlayers(-5, TODAY)).toHaveLength(1);
    expect(await topPlayers(7, TODAY)).toHaveLength(7);
  });
});

describe('rankOf', () => {
  it('returns the 1-based rank and current streak', async () => {
    await createPlayer('amy', streak(7));
    const bob = await createPlayer('bob', streak(5));
    await createPlayer('cat', streak(1));

    expect(await rankOf(bob, TODAY)).toEqual({ rank: 2, streak: 5 });
  });

  it('shares a rank with a player tied on streak and best', async () => {
    await createPlayer('amy', streak(5, 5));
    const bob = await createPlayer('bob', streak(5, 5));
    await createPlayer('cat', streak(3, 3));

    expect(await rankOf(bob, TODAY)).toEqual({ rank: 1, streak: 5 });
  });

  it('breaks a streak tie on best streak', async () => {
    await createPlayer('amy', streak(5, 9));
    const bob = await createPlayer('bob', streak(5, 5));

    expect(await rankOf(bob, TODAY)).toEqual({ rank: 2, streak: 5 });
  });

  it('ranks a player outside the top 100', async () => {
    await createPlayers(100, streak(5));
    const me = await createPlayer('me', streak(1));

    const top = await topPlayers(100, TODAY);
    expect(top.some((e) => e.handle === 'me')).toBe(false);
    expect(await rankOf(me, TODAY)).toEqual({ rank: 101, streak: 1 });
  });

  it('is null for a player without a handle', async () => {
    const anon = await createPlayer(null, streak(4));
    expect(await rankOf(anon, TODAY)).toBeNull();
  });

  it('is null for a lapsed streak, a zero streak, and an unknown user', async () => {
    const lapsed = await createPlayer('lapsed', streak(9, 9, TWO_DAYS_AGO));
    const zero = await createPlayer('zero', { currentStreak: 0, lastWinDay: TODAY });

    expect(await rankOf(lapsed, TODAY)).toBeNull();
    expect(await rankOf(zero, TODAY)).toBeNull();
    expect(await rankOf('00000000-0000-4000-8000-000000000000', TODAY)).toBeNull();
  });
});
