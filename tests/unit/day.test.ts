import { afterEach, describe, expect, it } from 'vitest';
import { addDays, brockNumber, launchDay, msUntilReset, previousDay, utcDay } from '@/lib/day';

describe('utcDay', () => {
  it('rolls over exactly at 00:00:00.000Z', () => {
    expect(utcDay(new Date('2026-03-09T23:59:59.999Z'))).toBe('2026-03-09');
    expect(utcDay(new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10');
  });

  it('uses UTC regardless of the offset in the input', () => {
    expect(utcDay(new Date('2026-03-09T23:30:00-05:00'))).toBe('2026-03-10');
  });
});

describe('previousDay', () => {
  it('crosses a month boundary', () => expect(previousDay('2026-03-01')).toBe('2026-02-28'));
  it('crosses a year boundary', () => expect(previousDay('2026-01-01')).toBe('2025-12-31'));
  it('handles Feb 29 in a leap year', () => {
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
    expect(previousDay('2028-02-29')).toBe('2028-02-28');
  });
  it('is the inverse of addDays(1)', () => expect(addDays(previousDay('2026-10-14'), 1)).toBe('2026-10-14'));
});

describe('brockNumber', () => {
  it('is 1 on launch day and counts up', () => {
    expect(brockNumber('2026-11-01', '2026-11-01')).toBe(1);
    expect(brockNumber('2026-11-02', '2026-11-01')).toBe(2);
    expect(brockNumber('2026-12-12', '2026-11-01')).toBe(42);
  });

  it('clamps days before launch to 1', () => {
    expect(brockNumber('2026-10-01', '2026-11-01')).toBe(1);
  });
});

describe('launchDay', () => {
  const original = process.env.LAUNCH_DAY;
  afterEach(() => {
    if (original === undefined) delete process.env.LAUNCH_DAY;
    else process.env.LAUNCH_DAY = original;
  });

  it('reads LAUNCH_DAY from the environment', () => {
    process.env.LAUNCH_DAY = '2027-01-01';
    expect(launchDay()).toBe('2027-01-01');
  });

  it('falls back to a default', () => {
    delete process.env.LAUNCH_DAY;
    expect(launchDay()).toBe('2026-11-01');
  });
});

describe('msUntilReset', () => {
  it('is a full day at midnight', () => {
    expect(msUntilReset(new Date('2026-03-10T00:00:00.000Z'))).toBe(86_400_000);
  });
  it('is 1ms one millisecond before midnight', () => {
    expect(msUntilReset(new Date('2026-03-09T23:59:59.999Z'))).toBe(1);
  });
  it('counts down mid-day', () => {
    expect(msUntilReset(new Date('2026-03-09T12:00:00.000Z'))).toBe(43_200_000);
  });
});
