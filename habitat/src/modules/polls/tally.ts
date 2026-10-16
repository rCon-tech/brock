export interface TallyRow {
  option: string;
  count: number;
  percent: number;
}

/**
 * Count votes per option. For a single-choice poll the percentages are shares of all votes and use
 * largest-remainder rounding so they add up to exactly 100. For multiple choice each option is the
 * percentage of voters who picked it, so the rows don't sum to 100.
 */
export function tally(
  options: string[],
  votes: Array<{ choices: string[] }>,
  opts: { multiple?: boolean } = {},
): TallyRow[] {
  const counts = new Map(options.map((o) => [o, 0]));
  for (const v of votes) {
    for (const c of new Set(v.choices)) if (counts.has(c)) counts.set(c, counts.get(c)! + 1);
  }
  const rows = options.map((option) => ({ option, count: counts.get(option)!, percent: 0 }));

  if (opts.multiple) {
    const voters = votes.length;
    for (const r of rows) r.percent = voters ? Math.round((r.count / voters) * 100) : 0;
    return rows;
  }

  const total = rows.reduce((n, r) => n + r.count, 0);
  if (!total) return rows;
  const exact = rows.map((r) => (r.count / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left-- <= 0) break;
    floors[i]!++;
  }
  rows.forEach((r, i) => (r.percent = floors[i]!));
  return rows;
}
