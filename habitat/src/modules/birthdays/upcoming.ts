export interface BirthdayEntry {
  userId: string;
  month: number; // 1-12
  day: number; // 1-31
  year?: number;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Feb 29 birthdays are celebrated on Feb 28 in non-leap years. */
export function effectiveDay(month: number, day: number, year: number): { month: number; day: number } {
  if (month === 2 && day === 29 && !isLeap(year)) return { month: 2, day: 28 };
  return { month, day };
}

/** Does this birthday fall on the given UTC calendar date? */
export function occursOn(b: Pick<BirthdayEntry, 'month' | 'day'>, date: Date): boolean {
  const e = effectiveDay(b.month, b.day, date.getUTCFullYear());
  return e.month === date.getUTCMonth() + 1 && e.day === date.getUTCDate();
}

const DAY = 86400_000;
const utcMidnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface UpcomingBirthday extends BirthdayEntry {
  date: string; // YYYY-MM-DD of the next occurrence
  inDays: number;
  turning?: number;
}

/** The next `n` birthdays from `today`, soonest first (today counts as 0 days away). */
export function upcoming(birthdays: BirthdayEntry[], today: Date, n: number): UpcomingBirthday[] {
  const start = utcMidnight(today);
  const out: UpcomingBirthday[] = [];
  for (const b of birthdays) {
    for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
      const e = effectiveDay(b.month, b.day, year);
      const at = Date.UTC(year, e.month - 1, e.day);
      if (at < start) continue;
      out.push({
        ...b,
        date: new Date(at).toISOString().slice(0, 10),
        inDays: Math.round((at - start) / DAY),
        turning: b.year ? year - b.year : undefined,
      });
      break;
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.userId.localeCompare(b.userId)).slice(0, n);
}

export function validMonthDay(month: number, day: number): boolean {
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return !!max && day >= 1 && day <= max;
}
