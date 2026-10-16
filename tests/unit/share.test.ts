import { describe, expect, it } from 'vitest';
import { buildShareText } from '@/lib/share';

describe('buildShareText', () => {
  it('shows one square per round and the run score', () => {
    expect(
      buildShareText({
        brockNumber: 42,
        results: ['draw', 'win', 'win', 'loss'],
        score: 2,
        url: 'https://brock.example.com/',
      }),
    ).toBe('Brock #42: run of 2 🔥\n⬜🟩🟩🟥\nbrock.example.com');
  });

  it('marks an extra life after a loss that was not the last round', () => {
    expect(
      buildShareText({ brockNumber: 3, results: ['win', 'loss', 'win', 'loss'], score: 2 }),
    ).toBe('Brock #3: run of 2 🔥\n🟩🟥❤️🟩🟥');
  });

  it('omits the url line when none is given', () => {
    expect(buildShareText({ brockNumber: 3, results: ['loss'], score: 0 })).toBe(
      'Brock #3: run of 0 🔥\n🟥',
    );
  });
});
