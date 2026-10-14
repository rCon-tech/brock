const MS_PER_DAY = 86_400_000;

/** Brock #1 falls on this UTC day unless LAUNCH_DAY overrides it. */
export const DEFAULT_LAUNCH_DAY = '2026-11-01';

/** A UTC calendar day formatted `YYYY-MM-DD`. */
export type Day = string;

export function utcDay(now: Date): Day {
  return now.toISOString().slice(0, 10);
}

function dayToMs(day: Day): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: Day, days: number): Day {
  return utcDay(new Date(dayToMs(day) + days * MS_PER_DAY));
}

export function previousDay(day: Day): Day {
  return addDays(day, -1);
}

export function launchDay(): Day {
  return process.env.LAUNCH_DAY || DEFAULT_LAUNCH_DAY;
}

/** Days since launch, 1-based. Days before launch are clamped to Brock #1. */
export function brockNumber(day: Day, launch: Day = launchDay()): number {
  const diff = Math.round((dayToMs(day) - dayToMs(launch)) / MS_PER_DAY);
  return Math.max(1, diff + 1);
}

/** Milliseconds until the next 00:00 UTC. */
export function msUntilReset(now: Date): number {
  const nextMidnight = dayToMs(utcDay(now)) + MS_PER_DAY;
  return nextMidnight - now.getTime();
}
