import { describe, expect, it } from 'vitest';
import { commit, houseThrow, newSalt, verify } from '@/lib/fairness';
import { THROWS } from '@/lib/game';

describe('commit / verify', () => {
  it('verifies an honest reveal', () => {
    const salt = newSalt();
    for (const t of THROWS) {
      expect(verify(commit(t, salt), t, salt)).toBe(true);
    }
  });

  it('rejects a tampered throw', () => {
    const salt = newSalt();
    expect(verify(commit('rock', salt), 'paper', salt)).toBe(false);
  });

  it('rejects a tampered salt', () => {
    const salt = newSalt();
    expect(verify(commit('rock', salt), 'rock', newSalt())).toBe(false);
  });

  it('rejects a malformed hash without throwing', () => {
    expect(verify('not-hex', 'rock', newSalt())).toBe(false);
    expect(verify('', 'rock', newSalt())).toBe(false);
  });

  it('is sha256 of "<throw>:<salt>" so clients can recompute it', () => {
    // printf 'rock:abc' | sha256sum
    expect(commit('rock', 'abc')).toBe('056c2fcf7699263e0aa19831eaf9cd04ff91ec3386a448d5e104c5577b55f4d6');
  });
});

describe('newSalt', () => {
  it('is 16 random bytes as hex and not repeated', () => {
    const a = newSalt();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newSalt()).not.toBe(a);
  });
});

describe('houseThrow', () => {
  it('is uniform within ±2% over 30k samples', () => {
    const N = 30_000;
    const counts = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < N; i++) counts[houseThrow()]++;
    for (const t of THROWS) {
      expect(Math.abs(counts[t] / N - 1 / 3)).toBeLessThan(0.02);
    }
  });
});
