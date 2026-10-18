import type { SynthesisResult } from './types';

export interface SwapOutcome {
  /** The replacement item, or null when the category has run out (R28). */
  itemId: string | null;
  /** The remaining queue for the category after taking the replacement. */
  remaining: string[];
}

/**
 * "Not quite, show me another": the next-best item in the same category, skipping anything that
 * has already been shown, swapped or vetoed.
 */
export function nextSwap(
  result: SynthesisResult,
  category: string,
  unavailable: Set<string>,
): SwapOutcome {
  const queue = result.swapQueue[category] ?? [];
  const shown = new Set(result.picks.map((p) => p.itemId));
  const next = queue.find((id) => !unavailable.has(id) && !shown.has(id)) ?? null;
  return { itemId: next, remaining: queue.filter((id) => id !== next) };
}
