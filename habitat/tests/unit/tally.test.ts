import { describe, expect, it } from 'vitest';
import { tally } from '@/modules/polls/tally';

describe('tally', () => {
  it('counts and shares single-choice votes, summing to exactly 100', () => {
    const rows = tally(
      ['a', 'b', 'c'],
      [{ choices: ['a'] }, { choices: ['b'] }, { choices: ['c'] }],
    );
    expect(rows.map((r) => r.count)).toEqual([1, 1, 1]);
    expect(rows.reduce((n, r) => n + r.percent, 0)).toBe(100); // 34/33/33, not 33/33/33
  });
  it('always sums to 100 for any split', () => {
    for (let a = 0; a <= 7; a++)
      for (let b = 0; b <= 7; b++)
        for (let c = 0; c <= 7; c++) {
          if (a + b + c === 0) continue;
          const votes = [...Array(a).fill('a'), ...Array(b).fill('b'), ...Array(c).fill('c')].map(
            (x) => ({ choices: [x] }),
          );
          expect(tally(['a', 'b', 'c'], votes).reduce((n, r) => n + r.percent, 0)).toBe(100);
        }
  });
  it('is all zeros with no votes', () => {
    expect(tally(['a', 'b'], []).map((r) => r.percent)).toEqual([0, 0]);
  });
  it('ignores choices that are not options and duplicate choices in one vote', () => {
    const rows = tally(['a', 'b'], [{ choices: ['a', 'a', 'zzz'] }]);
    expect(rows.map((r) => r.count)).toEqual([1, 0]);
  });
  it('multiple choice: percent of voters per option', () => {
    const rows = tally(['a', 'b'], [{ choices: ['a', 'b'] }, { choices: ['a'] }], {
      multiple: true,
    });
    expect(rows.map((r) => r.percent)).toEqual([100, 50]);
  });
});
