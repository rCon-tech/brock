import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { getToday, submitThrow } from '@/lib/brock-service';
import { DomainError } from '@/lib/errors';
import * as fairness from '@/lib/fairness';
import { createPlayer } from './setup';
import { at, BEATS, brockRow, draw, lose, play, playerRow, win } from './helpers';

const D1 = at('2026-11-01');
const D2 = at('2026-11-02');

const { brock, brockRound } = schema;

describe('getToday', () => {
  it('creates today’s run with one committed round', async () => {
    const playerId = await createPlayer('rich');
    const state = await getToday(playerId, D1);

    expect(state).toMatchObject({
      day: '2026-11-01',
      brockNumber: 1,
      status: 'playing',
      score: 0,
      best: 0,
      rounds: [],
      quiz: null,
      quizAvailable: false,
    });
    expect(state.openRound).toEqual({
      roundNo: 1,
      commitHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(state.msUntilReset).toBe(14 * 3600_000);
  });

  it('is idempotent: calling it twice creates one run and one round', async () => {
    const playerId = await createPlayer('rich');
    const a = await getToday(playerId, D1);
    const b = await getToday(playerId, D1);

    expect(b.openRound).toEqual(a.openRound);
    expect(await getDb().select().from(brock)).toHaveLength(1);
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('is safe under concurrent calls: still exactly one round', async () => {
    const playerId = await createPlayer('rich');
    const states = await Promise.all(Array.from({ length: 10 }, () => getToday(playerId, D1)));

    expect(new Set(states.map((s) => s.openRound!.commitHash)).size).toBe(1);
    expect(await getDb().select().from(brock)).toHaveLength(1);
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('gives each day its own run, starting from 0', async () => {
    const playerId = await createPlayer('rich');
    await win(playerId, D1);
    await win(playerId, D1);
    const b = await getToday(playerId, D2);

    expect(b).toMatchObject({ brockNumber: 2, status: 'playing', score: 0, best: 2, rounds: [] });
    expect(await getDb().select().from(brock)).toHaveLength(2);
  });

  it('works for a player who has not chosen a handle yet', async () => {
    const playerId = await createPlayer(null);
    expect(await getToday(playerId, D1)).toMatchObject({ handle: null, status: 'playing' });
  });

  it('reports the handle once the player has one', async () => {
    const playerId = await createPlayer('rich');
    expect((await getToday(playerId, D1)).handle).toBe('rich');
  });

  it('rejects an unknown player', async () => {
    await expect(getToday(randomUUID(), D1)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('treats a Brock won under the old one-a-day rules as finished, with no quiz', async () => {
    const playerId = await createPlayer('rich');
    await getToday(playerId, D1);
    await getDb().update(brock).set({ status: 'won', decidedAt: D1 });

    expect(await getToday(playerId, D1)).toMatchObject({
      status: 'over',
      openRound: null,
      quizAvailable: false,
    });
  });
});

describe('house throw secrecy', () => {
  it('never exposes the open round’s throw or salt', async () => {
    const playerId = await createPlayer('rich');
    const state = await getToday(playerId, D1);
    const [row] = await getDb().select().from(brockRound);

    expect(Object.keys(state.openRound!).sort()).toEqual(['commitHash', 'roundNo']);
    const json = JSON.stringify(state);
    expect(json).not.toContain(row.salt);
    expect(json).not.toContain('houseThrow');
  });

  it('keeps the next round secret after a win too', async () => {
    const playerId = await createPlayer('rich');
    const result = await win(playerId, D1);
    const rounds = await getDb().select().from(brockRound);
    const next = rounds.find((r) => r.roundNo === 2)!;

    expect(result.openRound).toEqual({ roundNo: 2, commitHash: next.commitHash });
    expect(JSON.stringify(result)).not.toContain(next.salt);
  });

  it('reveals throw and salt only after the player throws, and the hash verifies', async () => {
    const playerId = await createPlayer('rich');
    const before = await getToday(playerId, D1);
    const [row] = await getDb().select().from(brockRound);

    const result = await play(playerId, D1, 'rock', row.houseThrow);
    expect(result.round).toMatchObject({ roundNo: 1, house: row.houseThrow, salt: row.salt });
    expect(result.round.commitHash).toBe(before.openRound!.commitHash);
    expect(fairness.verify(result.round.commitHash, result.round.house, result.round.salt)).toBe(
      true,
    );
  });
});

describe('submitThrow', () => {
  it('a draw opens a new round and leaves the score alone', async () => {
    const playerId = await createPlayer('rich');
    const first = await getToday(playerId, D1);
    const result = await draw(playerId, D1);

    expect(result.round).toMatchObject({ player: 'rock', house: 'rock', result: 'draw' });
    expect(result).toMatchObject({ status: 'playing', score: 0, best: 0 });
    expect(result.rounds).toHaveLength(1);
    expect(result.openRound).toMatchObject({ roundNo: 2 });
    expect(result.openRound!.commitHash).not.toBe(first.openRound!.commitHash);
    expect((await playerRow(playerId)).totalWins).toBe(0);
  });

  it('a win adds 1 and the run keeps going with a fresh round', async () => {
    const playerId = await createPlayer('rich');
    const result = await win(playerId, D1);

    expect(result).toMatchObject({ status: 'playing', score: 1, best: 1, quizAvailable: false });
    expect(result.openRound).toMatchObject({ roundNo: 2 });
    expect(await playerRow(playerId)).toMatchObject({ bestScore: 1, totalWins: 1 });
    expect((await brockRow(playerId, D1)).decidedAt).toBeNull();
  });

  it('wins, draws and wins again: draws never count', async () => {
    const playerId = await createPlayer('rich');
    await win(playerId, D1);
    await draw(playerId, D1);
    await win(playerId, D1);
    const result = await win(playerId, D1);

    expect(result.score).toBe(3);
    expect(result.rounds.map((r) => r.result)).toEqual(['win', 'draw', 'win', 'win']);
    expect(result.openRound).toMatchObject({ roundNo: 5 });
  });

  it('a loss ends the run at its score and offers the quiz', async () => {
    const playerId = await createPlayer('rich');
    await win(playerId, D1);
    await win(playerId, D1);
    const result = await lose(playerId, D1);

    expect(result).toMatchObject({
      status: 'over',
      score: 2,
      best: 2,
      openRound: null,
      quiz: null,
      quizAvailable: true,
    });
    expect(await playerRow(playerId)).toMatchObject({
      bestScore: 2,
      totalWins: 2,
      totalLosses: 1,
    });
    const b = await brockRow(playerId, D1);
    expect(b).toMatchObject({ status: 'lost', score: 2 });
    expect(b.decidedAt).not.toBeNull();
  });

  it('losing straight away scores 0, and the quiz is still on offer', async () => {
    const playerId = await createPlayer('rich');
    expect(await lose(playerId, D1)).toMatchObject({ score: 0, quizAvailable: true });
  });

  it('a shorter run keeps the best from an earlier day', async () => {
    const playerId = await createPlayer('rich');
    await win(playerId, D1);
    await win(playerId, D1);
    await win(playerId, D1);
    await lose(playerId, D1);
    await win(playerId, D2);
    const result = await lose(playerId, D2);

    expect(result).toMatchObject({ score: 1, best: 3 });
    expect((await playerRow(playerId)).bestScore).toBe(3);
  });

  it('rejects a throw once the run is over (already_played)', async () => {
    const playerId = await createPlayer('rich');
    await lose(playerId, D1);

    await expect(submitThrow(playerId, { roundNo: 2, throw: 'rock' }, D1)).rejects.toMatchObject({
      code: 'already_played',
    });
    expect(await getDb().select().from(brockRound)).toHaveLength(1);
  });

  it('rejects the wrong round number (stale_round)', async () => {
    const playerId = await createPlayer('rich');
    await getToday(playerId, D1);

    await expect(submitThrow(playerId, { roundNo: 2, throw: 'rock' }, D1)).rejects.toMatchObject({
      code: 'stale_round',
    });
  });

  it('rejects replaying a round that was already won (stale_round)', async () => {
    const playerId = await createPlayer('rich');
    await win(playerId, D1); // round 2 is now open

    await expect(submitThrow(playerId, { roundNo: 1, throw: 'paper' }, D1)).rejects.toMatchObject({
      code: 'stale_round',
    });
    expect((await getToday(playerId, D1)).score).toBe(1);
  });

  it('rejects a throw when today’s run was never opened (new_day)', async () => {
    const playerId = await createPlayer('rich');
    await getToday(playerId, D1);

    await expect(submitThrow(playerId, { roundNo: 1, throw: 'rock' }, D2)).rejects.toMatchObject({
      code: 'new_day',
    });
  });

  it('only counts one of 10 simultaneous throws on the same round', async () => {
    const playerId = await createPlayer('rich');
    await getToday(playerId, D1);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, () => submitThrow(playerId, { roundNo: 1, throw: 'rock' }, D1)),
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
    const p = await playerRow(playerId);
    expect(p.totalWins + p.totalLosses).toBeLessThanOrEqual(1);
    expect((await brockRow(playerId, D1)).score).toBeLessThanOrEqual(1);
  });

  it('works with the House’s real random throw: beating it always wins', async () => {
    const playerId = await createPlayer('rich');
    const state = await getToday(playerId, D1);
    const [row] = await getDb().select().from(brockRound);
    const beat = (Object.keys(BEATS) as (keyof typeof BEATS)[]).find(
      (t) => BEATS[t] === row.houseThrow,
    )!;

    const result = await submitThrow(
      playerId,
      { roundNo: state.openRound!.roundNo, throw: beat },
      D1,
    );
    expect(result.round.result).toBe('win');
    expect(result.score).toBe(1);
  });
});
