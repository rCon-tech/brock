import type { RoundResult } from './game';

export interface ShareInput {
  brockNumber: number;
  /** Every round of the day's run, in order. */
  results: RoundResult[];
  score: number;
  url?: string;
}

const SQUARE: Record<RoundResult, string> = { win: '🟩', draw: '⬜', loss: '🟥' };

/**
 * Wordle-style result text, e.g.
 *   Brock #42: run of 3 🔥
 *   🟩⬜🟩🟥❤️🟩🟥
 *   brock.example.com
 * One square per round. ❤️ marks an extra life won in the quiz after a loss, 🎲 the risked Brock.
 */
export function buildShareText({ brockNumber, results, score, url }: ShareInput): string {
  // A loss that isn't the last round was undone: first by the quiz's life, then by the risk.
  let comebacks = 0;
  const squares = results
    .map((r, i) => {
      if (r !== 'loss' || i === results.length - 1) return SQUARE[r];
      return SQUARE[r] + (comebacks++ === 0 ? '❤️' : '🎲');
    })
    .join('');
  const lines = [`Brock #${brockNumber}: run of ${score} 🔥`, squares];
  if (url) lines.push(url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  return lines.join('\n');
}
