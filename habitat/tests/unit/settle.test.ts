import { describe, expect, it } from 'vitest';
import { balances, shares, transfers, type Expense } from '@/modules/split-costs/settle';

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('shares', () => {
  it('splits exactly, giving remainder pence to the first people in a stable order', () => {
    expect([...shares(100, ['c', 'a', 'b'])]).toEqual([['a', 34], ['b', 33], ['c', 33]]);
    expect([...shares(101, ['b', 'a', 'c'])].map(([, n]) => n)).toEqual([34, 34, 33]);
  });
  it('de-duplicates people and handles one or zero', () => {
    expect([...shares(500, ['a', 'a'])]).toEqual([['a', 500]]);
    expect(shares(500, []).size).toBe(0);
  });
});

describe('balances', () => {
  it('payer is owed the others’ shares', () => {
    const b = balances([{ amountMinor: 3000, currency: 'GBP', paidBy: 'a', splitAmong: ['a', 'b', 'c'] }]);
    expect(b.GBP).toEqual({ a: 2000, b: -1000, c: -1000 });
  });
  it('settlements reduce what is owed', () => {
    const e: Expense = { amountMinor: 3000, currency: 'GBP', paidBy: 'a', splitAmong: ['a', 'b', 'c'] };
    const b = balances([e], [{ from: 'b', to: 'a', amountMinor: 1000, currency: 'GBP' }]);
    expect(b.GBP).toEqual({ a: 1000, c: -1000 });
  });
  it('keeps currencies apart', () => {
    const b = balances([
      { amountMinor: 1000, currency: 'GBP', paidBy: 'a', splitAmong: ['a', 'b'] },
      { amountMinor: 2000, currency: 'EUR', paidBy: 'b', splitAmong: ['a', 'b'] },
    ]);
    expect(b.GBP).toEqual({ a: 500, b: -500 });
    expect(b.EUR).toEqual({ a: -1000, b: 1000 });
  });
  it('sums to zero over 1,000 randomised expense sets', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const people = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let run = 0; run < 1000; run++) {
      const expenses: Expense[] = Array.from({ length: 1 + rnd(8) }, () => ({
        amountMinor: 1 + rnd(100000),
        currency: 'GBP',
        paidBy: people[rnd(people.length)]!,
        splitAmong: people.filter(() => rnd(2) === 1).concat(people[rnd(people.length)]!),
      }));
      const settlements = Array.from({ length: rnd(3) }, () => ({
        from: people[rnd(7)]!,
        to: people[rnd(7)]!,
        amountMinor: 1 + rnd(5000),
        currency: 'GBP',
      }));
      const b = balances(expenses, settlements).GBP ?? {};
      expect(sum(b)).toBe(0);
      const t = transfers(b);
      // applying the transfers zeroes everyone
      const after = { ...b };
      for (const x of t) {
        after[x.from] = (after[x.from] ?? 0) + x.amountMinor;
        after[x.to] = (after[x.to] ?? 0) - x.amountMinor;
      }
      expect(Object.values(after).every((n) => n === 0)).toBe(true);
      expect(t.length).toBeLessThanOrEqual(Math.max(0, Object.keys(b).length - 1));
    }
  });
});

describe('transfers', () => {
  it('one payment settles a simple debt', () => {
    expect(transfers({ a: 1000, b: -1000 })).toEqual([{ from: 'b', to: 'a', amountMinor: 1000 }]);
  });
  it('uses the fewest payments for a chain', () => {
    // b owes a 10 and c owes b 10 collapses into c paying a
    expect(transfers({ a: 1000, b: 0, c: -1000 })).toEqual([{ from: 'c', to: 'a', amountMinor: 1000 }]);
  });
  it('is deterministic on ties and empty when settled', () => {
    expect(transfers({ a: 500, b: 500, c: -500, d: -500 })).toEqual([
      { from: 'c', to: 'a', amountMinor: 500 },
      { from: 'd', to: 'b', amountMinor: 500 },
    ]);
    expect(transfers({})).toEqual([]);
  });
});

import { parseMoneyInput } from '@/modules/split-costs/settle';

describe('parseMoneyInput', () => {
  it('parses plain amounts exactly', () => {
    expect(parseMoneyInput('12')).toBe(1200);
    expect(parseMoneyInput('12.5')).toBe(1250);
    expect(parseMoneyInput('12,05')).toBe(1205);
    expect(parseMoneyInput(' 0.07 ')).toBe(7);
    expect(parseMoneyInput('19.99')).toBe(1999); // 19.99 * 100 would be 1998.9999999999998 as a float
  });
  it('rejects junk, zero, negatives and too many decimals', () => {
    for (const bad of ['', 'abc', '-5', '0', '0.00', '1.234', '1e3', '£5', '12.', '.5']) expect(parseMoneyInput(bad)).toBeNull();
  });
});
