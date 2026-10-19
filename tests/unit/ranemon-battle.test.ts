import { describe, expect, it } from 'vitest';
import {
  damage,
  effectiveness,
  pickRandomMove,
  playTurn,
  startBattle,
  turnOrder,
  type Rng,
  type Species,
} from '@/lib/ranemon/battle';
import { SPECIES, speciesById } from '@/lib/ranemon/species';

const always =
  (value: number): Rng =>
  () =>
    value;

const boulderon = speciesById('boulderon');
const origamew = speciesById('origamew');
const snipsnap = speciesById('snipsnap');

describe('effectiveness', () => {
  it.each([
    ['rock', 'scissors', 2],
    ['scissors', 'paper', 2],
    ['paper', 'rock', 2],
    ['scissors', 'rock', 0.5],
    ['paper', 'scissors', 0.5],
    ['rock', 'paper', 0.5],
    ['rock', 'rock', 1],
    ['normal', 'rock', 1],
    ['paper', 'normal', 1],
  ] as const)('%s into %s is x%s', (move, defender, expected) => {
    expect(effectiveness(move, defender)).toBe(expected);
  });
});

describe('damage', () => {
  const rockslide = boulderon.moves.find((m) => m.id === 'rockslide')!;

  it('doubles against a weak type and halves against a strong one', () => {
    const neutral = { ...boulderon, id: 'x', type: 'normal' as const };
    const vsNeutral = damage(boulderon, neutral, rockslide, 1);
    const vsWeak = damage(boulderon, { ...neutral, type: 'scissors' }, rockslide, 1);
    const vsStrong = damage(boulderon, { ...neutral, type: 'paper' }, rockslide, 1);
    expect(vsWeak).toBeGreaterThanOrEqual(vsNeutral * 2 - 1);
    expect(vsStrong).toBeLessThanOrEqual(Math.ceil(vsNeutral / 2));
  });

  it('gives a same-type bonus', () => {
    const tackle = boulderon.moves.find((m) => m.id === 'tackle')!;
    const rockTackle = { ...tackle, type: 'rock' as const };
    // Rock and normal are both neutral into Boulderon, so only the bonus differs.
    expect(damage(boulderon, boulderon, rockTackle, 1)).toBeGreaterThan(
      damage(boulderon, boulderon, tackle, 1),
    );
  });

  it('always does at least 1', () => {
    const weakling: Species = { ...origamew, attack: 1 };
    expect(damage(weakling, boulderon, weakling.moves[0], 0)).toBe(1);
  });
});

describe('turnOrder', () => {
  it('lets the faster creature go first', () => {
    expect(turnOrder(startBattle(boulderon, snipsnap), always(0))).toEqual([1, 0]);
    expect(turnOrder(startBattle(snipsnap, boulderon), always(0))).toEqual([0, 1]);
  });

  it('flips a coin on a speed tie', () => {
    const state = startBattle(origamew, origamew);
    expect(turnOrder(state, always(0.1))).toEqual([0, 1]);
    expect(turnOrder(state, always(0.9))).toEqual([1, 0]);
  });
});

describe('playTurn', () => {
  it('has both sides hit and leaves the old state alone', () => {
    const start = startBattle(boulderon, origamew);
    const { state, events } = playTurn(start, ['tackle', 'tackle'], always(0.5));
    expect(state.fighters[0].hp).toBeLessThan(boulderon.maxHp);
    expect(state.fighters[1].hp).toBeLessThan(origamew.maxHp);
    expect(start.fighters[0].hp).toBe(boulderon.maxHp);
    expect(state.turn).toBe(2);
    expect(events.filter((e) => e.kind === 'move').map((e) => e.side)).toEqual([1, 0]);
  });

  it('ends when a creature faints, and the fainted one does not act', () => {
    let state = startBattle(snipsnap, origamew);
    state = { ...state, fighters: [state.fighters[0], { ...state.fighters[1], hp: 1 }] };
    const result = playTurn(state, ['shear', 'wrap'], always(0.5));
    expect(result.state.winner).toBe(0);
    expect(result.state.fighters[1].hp).toBe(0);
    expect(result.events.filter((e) => e.kind === 'move')).toHaveLength(1);
    expect(result.events.at(-1)).toEqual({ kind: 'faint', side: 1 });
    expect(() => playTurn(result.state, ['shear', 'wrap'], always(0.5))).toThrow();
  });

  it('rejects a move the creature does not know', () => {
    expect(() =>
      playTurn(startBattle(boulderon, origamew), ['wrap', 'tackle'], always(0)),
    ).toThrow();
  });

  it('always reaches a winner when both sides play at random', () => {
    let seed = 42;
    const rng: Rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (const a of SPECIES) {
      for (const b of SPECIES) {
        let state = startBattle(a, b);
        while (state.winner === null && state.turn < 100) {
          const moves: [string, string] = [
            pickRandomMove(state.fighters[0], rng),
            pickRandomMove(state.fighters[1], rng),
          ];
          state = playTurn(state, moves, rng).state;
        }
        expect(state.winner).not.toBeNull();
      }
    }
  });
});
