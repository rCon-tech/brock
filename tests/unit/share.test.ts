import { describe, expect, it } from 'vitest';
import { buildShareText } from '@/lib/share';

describe('buildShareText', () => {
  it('formats a win with a draw first', () => {
    expect(
      buildShareText({
        brockNumber: 42,
        rounds: [
          { player: 'rock', house: 'rock' },
          { player: 'paper', house: 'rock' },
        ],
        status: 'won',
        streak: 7,
        url: 'https://brock.example.com/',
      }),
    ).toBe('Brock #42 🔥7\n🪨📄 → 🪨🪨 ✅\nbrock.example.com');
  });

  it('formats a loss and omits the url line when none is given', () => {
    expect(
      buildShareText({
        brockNumber: 3,
        rounds: [{ player: 'scissors', house: 'rock' }],
        status: 'lost',
        streak: 0,
      }),
    ).toBe('Brock #3 🔥0\n✂️ → 🪨 ❌');
  });
});
