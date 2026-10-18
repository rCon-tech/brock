import type { SynthesisResult } from './types';

export const TIEBREAK_COUNT = 8;
export const MAX_TIEBREAK_ROUNDS = 2;

/**
 * The next tie-breaker round (§11.4): the best compromise picks nobody has swiped yet, in the
 * order the board shows them.
 */
export function tiebreakCards(
  result: SynthesisResult,
  swipedByAnyone: Set<string>,
  alreadyUsed: Set<string> = new Set(),
): string[] {
  return result.picks
    .map((p) => p.itemId)
    .filter((id) => !swipedByAnyone.has(id) && !alreadyUsed.has(id))
    .slice(0, TIEBREAK_COUNT);
}
