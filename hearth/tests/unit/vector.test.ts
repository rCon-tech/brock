import { describe, expect, it } from 'vitest';
import { cosine, mean, normalise, weightedMean } from '@/lib/engine/vector';

describe('vector maths', () => {
  it('normalises to unit length and leaves zero vectors alone', () => {
    expect(normalise([3, 4])).toEqual([0.6, 0.8]);
    expect(normalise([0, 0])).toEqual([0, 0]);
  });

  it('computes cosine similarity', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosine([0, 0], [1, 0])).toBe(0);
  });

  it('takes weighted means', () => {
    expect(
      weightedMean([
        { v: [1, 0], w: 3 },
        { v: [0, 1], w: 1 },
      ]),
    ).toEqual([0.75, 0.25]);
    expect(weightedMean([])).toBeNull();
    expect(mean([1, 2, 3])).toBe(2);
  });
});
