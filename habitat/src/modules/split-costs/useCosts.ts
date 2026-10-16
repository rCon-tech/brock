'use client';

import { useMemo } from 'react';
import { useRecords } from '../sdk/hooks';
import {
  balances,
  transfers,
  type Balances,
  type Expense,
  type Settlement,
  type Transfer,
} from './settle';

type Money = { amountMinor: number; currency: string };

export function useCosts() {
  const expenses = useRecords<{
    description: string;
    amount: Money;
    paidBy: string;
    splitAmong: string[];
  }>({
    module: 'split-costs',
    collection: 'expense',
    limit: 100,
    pollMs: 30_000,
  });
  const settlements = useRecords<{ from: string; to: string; amount: Money }>({
    module: 'split-costs',
    collection: 'settlement',
    limit: 100,
    pollMs: 30_000,
  });

  const result = useMemo(() => {
    const e: Expense[] = expenses.items.map((r) => ({
      amountMinor: r.data.amount.amountMinor,
      currency: r.data.amount.currency,
      paidBy: r.data.paidBy,
      splitAmong: r.data.splitAmong,
    }));
    const s: Settlement[] = settlements.items.map((r) => ({
      from: r.data.from,
      to: r.data.to,
      amountMinor: r.data.amount.amountMinor,
      currency: r.data.amount.currency,
    }));
    const b: Balances = balances(e, s);
    const t: Record<string, Transfer[]> = Object.fromEntries(
      Object.entries(b).map(([cur, bal]) => [cur, transfers(bal)]),
    );
    return { balances: b, transfers: t };
  }, [expenses.items, settlements.items]);

  return {
    expenses,
    settlements,
    ...result,
    loading: expenses.isLoading || settlements.isLoading,
    // Only trust totals once every page is in; otherwise balances would silently be wrong.
    incomplete: !!expenses.hasNextPage || !!settlements.hasNextPage,
  };
}
