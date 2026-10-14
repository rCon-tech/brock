import { THROW_EMOJI, type Throw } from './game';

export interface ShareRound {
  player: Throw;
  house: Throw;
}

export interface ShareInput {
  brockNumber: number;
  rounds: ShareRound[];
  status: 'won' | 'lost';
  streak: number;
  url?: string;
}

/**
 * Wordle-style result text, e.g.
 *   Brock #42 🔥7
 *   🪨📄 → 🪨✂️ ✅
 *   brock.example.com
 * Player throws are on the left of the arrow, the House's on the right.
 */
export function buildShareText({ brockNumber, rounds, status, streak, url }: ShareInput): string {
  const player = rounds.map((r) => THROW_EMOJI[r.player]).join('');
  const house = rounds.map((r) => THROW_EMOJI[r.house]).join('');
  const lines = [
    `Brock #${brockNumber} 🔥${streak}`,
    `${player} → ${house} ${status === 'won' ? '✅' : '❌'}`,
  ];
  if (url) lines.push(url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  return lines.join('\n');
}
