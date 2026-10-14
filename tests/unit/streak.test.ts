import { describe, expect, it } from 'vitest';
import { applyLoss, applyWin, effectiveStreak, type StreakState } from '@/lib/streak';

const fresh: StreakState = { currentStreak: 0, bestStreak: 0, lastWinDay: null };

describe('applyWin', () => {
  it('starts a streak at 1 for a new player', () => {
    expect(applyWin(fresh, '2026-11-01')).toEqual({
      currentStreak: 1,
      bestStreak: 1,
      lastWinDay: '2026-11-01',
    });
  });

  it('extends the streak after yesterday’s win', () => {
    const player: StreakState = { currentStreak: 3, bestStreak: 5, lastWinDay: '2026-11-01' };
    expect(applyWin(player, '2026-11-02')).toEqual({
      currentStreak: 4,
      bestStreak: 5,
      lastWinDay: '2026-11-02',
    });
  });

  it('raises the best streak when the current one passes it', () => {
    const player: StreakState = { currentStreak: 5, bestStreak: 5, lastWinDay: '2026-11-01' };
    expect(applyWin(player, '2026-11-02').bestStreak).toBe(6);
  });

  it('restarts at 1 after a gap, keeping the best', () => {
    const player: StreakState = { currentStreak: 4, bestStreak: 4, lastWinDay: '2026-11-01' };
    expect(applyWin(player, '2026-11-03')).toEqual({
      currentStreak: 1,
      bestStreak: 4,
      lastWinDay: '2026-11-03',
    });
  });

  it('continues across a month boundary', () => {
    const player: StreakState = { currentStreak: 2, bestStreak: 2, lastWinDay: '2026-11-30' };
    expect(applyWin(player, '2026-12-01').currentStreak).toBe(3);
  });
});

describe('applyLoss', () => {
  it('resets the current streak and keeps everything else', () => {
    const player: StreakState = { currentStreak: 7, bestStreak: 9, lastWinDay: '2026-11-01' };
    expect(applyLoss(player)).toEqual({ currentStreak: 0, bestStreak: 9, lastWinDay: '2026-11-01' });
  });
});

describe('effectiveStreak', () => {
  const player: StreakState = { currentStreak: 6, bestStreak: 9, lastWinDay: '2026-11-10' };

  it('counts when the last win was today', () => {
    expect(effectiveStreak(player, '2026-11-10')).toBe(6);
  });
  it('counts when the last win was yesterday (still defendable today)', () => {
    expect(effectiveStreak(player, '2026-11-11')).toBe(6);
  });
  it('is 0 after a missed day', () => {
    expect(effectiveStreak(player, '2026-11-12')).toBe(0);
  });
  it('is 0 for a player who never won', () => {
    expect(effectiveStreak(fresh, '2026-11-12')).toBe(0);
  });
});
