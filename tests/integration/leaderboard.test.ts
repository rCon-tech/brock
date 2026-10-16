import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { createPlayer, createPlayers } from './setup';

const TODAY = '2026-11-10';
const YESTERDAY = '2026-11-09';

/** A named (or unnamed) player with a run of `score` on `day`, and a best of at least that. */
async function withRun(
  handle: string | null,
  score: number,
  opts: { day?: string; best?: number; playing?: boolean } = {},
) {
  const id = await createPlayer(handle, { bestScore: Math.max(score, opts.best ?? 0) });
  await getDb()
    .insert(schema.brock)
    .values({
      playerId: id,
      day: opts.day ?? TODAY,
      score,
      status: opts.playing ? 'pending' : 'lost',
    });
  return id;
}

const handles = (entries: { handle: string }[]) => entries.map((e) => e.handle);

describe('topPlayers: today', () => {
  it('ranks today’s runs by score, then handle, with ties sharing a rank', async () => {
    await withRun('zed', 5);
    await withRun('amy', 5);
    await withRun('cat', 7);
    await withRun('dan', 1);

    const board = await topPlayers('today', 100, TODAY);
    expect(board.map((e) => [e.handle, e.rank, e.score])).toEqual([
      ['cat', 1, 7],
      ['amy', 2, 5],
      ['zed', 2, 5],
      ['dan', 4, 1],
    ]);
  });

  it('marks runs that are still going', async () => {
    await withRun('live', 3, { playing: true });
    await withRun('done', 2);

    const board = await topPlayers('today', 100, TODAY);
    expect(board.map((e) => [e.handle, e.playing])).toEqual([
      ['live', true],
      ['done', false],
    ]);
  });

  it('only counts today: yesterday’s runs and all-time bests don’t show', async () => {
    await withRun('old', 9, { day: YESTERDAY });
    await withRun('now', 1, { best: 20 });

    expect(handles(await topPlayers('today', 100, TODAY))).toEqual(['now']);
  });

  it('leaves out runs of 0 and players without a handle', async () => {
    await withRun('zero', 0);
    await withRun(null, 9);
    await withRun('named', 1);

    expect(handles(await topPlayers('today', 100, TODAY))).toEqual(['named']);
  });

  it('is empty when nobody has won today', async () => {
    expect(await topPlayers('today', 100, TODAY)).toEqual([]);
  });
});

describe('topPlayers: all-time', () => {
  it('ranks every player’s best run, whatever day it was', async () => {
    await withRun('old', 2, { day: YESTERDAY, best: 9 });
    await withRun('now', 4);
    await withRun('tie', 4, { day: YESTERDAY });

    const board = await topPlayers('all', 100, TODAY);
    expect(board.map((e) => [e.handle, e.rank, e.score, e.playing])).toEqual([
      ['old', 1, 9, false],
      ['now', 2, 4, false],
      ['tie', 2, 4, false],
    ]);
  });

  it('leaves out players with no wins and players without a handle', async () => {
    await createPlayer('newbie');
    await createPlayer(null, { bestScore: 9 });
    await createPlayer('named', { bestScore: 1 });

    expect(handles(await topPlayers('all', 100, TODAY))).toEqual(['named']);
  });

  it('clamps the limit to 1–100', async () => {
    await createPlayers(105, { bestScore: 3 });

    expect(await topPlayers('all', 1000, TODAY)).toHaveLength(100);
    expect(await topPlayers('all', 0, TODAY)).toHaveLength(1);
    expect(await topPlayers('all', -5, TODAY)).toHaveLength(1);
    expect(await topPlayers('all', 7, TODAY)).toHaveLength(7);
  });
});

describe('rankOf', () => {
  it('returns the rank and score on each board', async () => {
    await withRun('amy', 7);
    const bob = await withRun('bob', 5, { best: 10 });
    await withRun('cat', 1);

    expect(await rankOf(bob, 'today', TODAY)).toEqual({ rank: 2, score: 5 });
    expect(await rankOf(bob, 'all', TODAY)).toEqual({ rank: 1, score: 10 });
  });

  it('shares a rank with a tied player', async () => {
    await withRun('amy', 5);
    const bob = await withRun('bob', 5);

    expect(await rankOf(bob, 'today', TODAY)).toEqual({ rank: 1, score: 5 });
  });

  it('ranks a player outside the top 100', async () => {
    await createPlayers(100, { bestScore: 5 });
    const me = await createPlayer('me', { bestScore: 1 });

    const top = await topPlayers('all', 100, TODAY);
    expect(top.some((e) => e.handle === 'me')).toBe(false);
    expect(await rankOf(me, 'all', TODAY)).toEqual({ rank: 101, score: 1 });
  });

  it('is null when not on the board: no handle, no win today, or unknown', async () => {
    const anon = await withRun(null, 4);
    const yesterday = await withRun('yday', 4, { day: YESTERDAY });

    expect(await rankOf(anon, 'today', TODAY)).toBeNull();
    expect(await rankOf(anon, 'all', TODAY)).toBeNull();
    expect(await rankOf(yesterday, 'today', TODAY)).toBeNull();
    expect(await rankOf('00000000-0000-4000-8000-000000000000', 'all', TODAY)).toBeNull();
  });
});
