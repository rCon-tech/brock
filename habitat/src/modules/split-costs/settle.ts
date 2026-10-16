/** All money is integer minor units (pence, cents). No floats anywhere in this file. */
export interface Expense {
  amountMinor: number;
  currency: string;
  paidBy: string;
  splitAmong: string[];
}
export interface Settlement {
  from: string;
  to: string;
  amountMinor: number;
  currency: string;
}
export interface Transfer {
  from: string;
  to: string;
  amountMinor: number;
}

/** Positive: the group owes this person. Negative: this person owes the group. One map per currency. */
export type Balances = Record<string, Record<string, number>>;

/**
 * Split `amount` between `people` exactly. The remainder pence go one each to the first people in
 * a stable (sorted) order, so everyone's shares add up to the amount.
 */
export function shares(amountMinor: number, people: string[]): Map<string, number> {
  const ids = [...new Set(people)].sort();
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const base = Math.floor(amountMinor / ids.length);
  let extra = amountMinor - base * ids.length;
  for (const id of ids) {
    out.set(id, base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra--;
  }
  return out;
}

export function balances(expenses: Expense[], settlements: Settlement[] = []): Balances {
  const out: Balances = {};
  const add = (cur: string, id: string, n: number) => {
    const m = (out[cur] ??= {});
    m[id] = (m[id] ?? 0) + n;
  };
  for (const e of expenses) {
    add(e.currency, e.paidBy, e.amountMinor);
    for (const [id, share] of shares(e.amountMinor, e.splitAmong)) add(e.currency, id, -share);
  }
  for (const s of settlements) {
    add(s.currency, s.from, s.amountMinor);
    add(s.currency, s.to, -s.amountMinor);
  }
  for (const cur of Object.keys(out)) {
    for (const id of Object.keys(out[cur]!)) if (out[cur]![id] === 0) delete out[cur]![id];
  }
  return out;
}

/** Fewest payments (greedy, largest debtor pays largest creditor) that bring everyone to zero. */
export function transfers(balance: Record<string, number>): Transfer[] {
  const creditors = Object.entries(balance)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n }));
  const debtors = Object.entries(balance)
    .filter(([, n]) => n < 0)
    .map(([id, n]) => ({ id, n: -n }));
  const byAmountThenId = (a: { id: string; n: number }, b: { id: string; n: number }) =>
    b.n - a.n || a.id.localeCompare(b.id);
  const out: Transfer[] = [];
  for (;;) {
    creditors.sort(byAmountThenId);
    debtors.sort(byAmountThenId);
    const c = creditors[0];
    const d = debtors[0];
    if (!c || !d || c.n === 0 || d.n === 0) break;
    const amount = Math.min(c.n, d.n);
    out.push({ from: d.id, to: c.id, amountMinor: amount });
    c.n -= amount;
    d.n -= amount;
    if (c.n === 0) creditors.shift();
    if (d.n === 0) debtors.shift();
  }
  return out;
}

export function formatMoney(amountMinor: number, currency: string, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100);
}

/** "12.5" → 1250. Rejects anything that isn't a plain amount with at most two decimals. No floats. */
export function parseMoneyInput(input: string): number | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  return minor > 0 ? minor : null;
}
