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
 * One square per round. ❤️ marks an extra life won in the quiz after a loss.
 */
export function buildShareText({ brockNumber, results, score, url }: ShareInput): string {
  const squares = results
    .map((r, i) => SQUARE[r] + (r === 'loss' && i < results.length - 1 ? '❤️' : ''))
    .join('');
  const lines = [`Brock #${brockNumber}: run of ${score} 🔥`, squares];
  if (url) lines.push(url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  return lines.join('\n');
}
