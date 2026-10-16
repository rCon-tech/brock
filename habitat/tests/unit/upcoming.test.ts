import { describe, expect, it } from 'vitest';
import { effectiveDay, occursOn, upcoming, validMonthDay } from '@/modules/birthdays/upcoming';

const d = (s: string) => new Date(`${s}T10:30:00Z`);

describe('birthdays', () => {
  it('Feb 29 falls on Feb 28 in non-leap years and Feb 29 in leap years', () => {
    expect(effectiveDay(2, 29, 2027)).toEqual({ month: 2, day: 28 });
    expect(effectiveDay(2, 29, 2028)).toEqual({ month: 2, day: 29 });
    expect(effectiveDay(2, 29, 2100)).toEqual({ month: 2, day: 28 }); // not a leap year
    expect(effectiveDay(2, 29, 2000)).toEqual({ month: 2, day: 29 });
    expect(occursOn({ month: 2, day: 29 }, d('2027-02-28'))).toBe(true);
    expect(occursOn({ month: 2, day: 29 }, d('2027-03-01'))).toBe(false);
  });

  it('lists the next birthdays soonest first, today counting as 0 days', () => {
    const list = upcoming(
      [
        { userId: 'a', month: 3, day: 10 },
        { userId: 'b', month: 1, day: 5 },
        { userId: 'c', month: 3, day: 1, year: 1990 },
      ],
      d('2026-03-01'),
      3,
    );
    expect(list.map((b) => [b.userId, b.inDays])).toEqual([
      ['c', 0],
      ['a', 9],
      ['b', 310],
    ]);
    expect(list[0]!.turning).toBe(36);
    expect(list[2]!.date).toBe('2027-01-05');
  });

  it('wraps over the new year and honours n', () => {
    const list = upcoming(
      [
        { userId: 'a', month: 1, day: 2 },
        { userId: 'b', month: 12, day: 30 },
      ],
      d('2026-12-29'),
      1,
    );
    expect(list.map((b) => b.userId)).toEqual(['b']);
    expect(upcoming([{ userId: 'a', month: 1, day: 2 }], d('2026-12-29'), 5)[0]).toMatchObject({
      date: '2027-01-02',
      inDays: 4,
    });
  });

  it('a Feb 29 birthday upcoming from Jan 2027 is on Feb 28', () => {
    expect(upcoming([{ userId: 'a', month: 2, day: 29 }], d('2027-01-10'), 1)[0]!.date).toBe(
      '2027-02-28',
    );
  });

  it('validates month/day combinations', () => {
    expect(validMonthDay(2, 29)).toBe(true);
    expect(validMonthDay(2, 30)).toBe(false);
    expect(validMonthDay(4, 31)).toBe(false);
    expect(validMonthDay(13, 1)).toBe(false);
    expect(validMonthDay(1, 0)).toBe(false);
  });
});
