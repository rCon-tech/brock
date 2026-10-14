import { describe, expect, it } from 'vitest';
import { isThrow, resolveRound, THROWS, type RoundResult, type Throw } from '@/lib/game';

describe('resolveRound', () => {
  const table: [Throw, Throw, RoundResult][] = [
    ['rock', 'rock', 'draw'],
    ['rock', 'paper', 'loss'],
    ['rock', 'scissors', 'win'],
    ['paper', 'rock', 'win'],
    ['paper', 'paper', 'draw'],
    ['paper', 'scissors', 'loss'],
    ['scissors', 'rock', 'loss'],
    ['scissors', 'paper', 'win'],
    ['scissors', 'scissors', 'draw'],
  ];

  it.each(table)('%s vs house %s -> %s', (player, house, expected) => {
    expect(resolveRound(player, house)).toBe(expected);
  });

  it('covers all 9 combinations', () => {
    expect(table).toHaveLength(THROWS.length * THROWS.length);
  });
});

describe('isThrow', () => {
  it('accepts the three throws only', () => {
    expect(THROWS.every(isThrow)).toBe(true);
    expect(isThrow('lizard')).toBe(false);
    expect(isThrow(undefined)).toBe(false);
    expect(isThrow(1)).toBe(false);
  });
});
