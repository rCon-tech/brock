import { previousDay, type Day } from './day';

export interface StreakState {
  currentStreak: number;
  bestStreak: number;
  lastWinDay: Day | null;
}

/** A win on `today` extends the streak only if the previous win was yesterday; otherwise it starts at 1. */
export function applyWin(player: StreakState, today: Day): StreakState {
  const continues = player.lastWinDay === previousDay(today);
  const currentStreak = continues ? player.currentStreak + 1 : 1;
  return {
    currentStreak,
    bestStreak: Math.max(player.bestStreak, currentStreak),
    lastWinDay: today,
  };
}

export function applyLoss(player: StreakState): StreakState {
  return { ...player, currentStreak: 0 };
}

/**
 * The streak a player actually has on `today`. A streak lapses once a whole day passes
 * without a win, so no cron job is needed: the stored value is simply overwritten on the
 * next win or loss.
 */
export function effectiveStreak(player: StreakState, today: Day): number {
  if (player.lastWinDay === today || player.lastWinDay === previousDay(today)) {
    return player.currentStreak;
  }
  return 0;
}
