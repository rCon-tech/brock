'use client';

import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { displayName } from '@/components/MemberAvatar';
import { Button } from '@/components/ui/button';
import { Badge, Card, Skeleton } from '@/components/ui/card';
import { errorMessage } from '@/lib/api-client';
import { isAdmin, useHabitat, useMemberLookup } from '../sdk/context';
import { useCreateRecord, useDeleteRecord } from '../sdk/hooks';
import { ExpenseForm } from './ExpenseForm';
import { formatMoney } from './settle';
import { useCosts } from './useCosts';

export function Page() {
  const { me } = useHabitat();
  const who = useMemberLookup();
  const costs = useCosts();
  const [adding, setAdding] = useState(false);
  const settle = useCreateRecord('split-costs', 'settlement');
  const remove = useDeleteRecord('split-costs');
  const name = (id: string) => (id === me.id ? 'You' : displayName(who(id)));
  const currencies = Object.keys(costs.balances);
  const defaultCurrency = costs.expenses.items[0]?.data.amount.currency ?? 'GBP';

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Split costs</h1>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} /> Add expense
        </Button>
      </div>

      {costs.loading ? (
        <Skeleton className="h-32" />
      ) : (
        <Card className="space-y-3">
          <h2 className="font-bold">Settle up</h2>
          {costs.incomplete && <p className="rounded-lg bg-surface-2 p-2 text-sm">Showing the latest 100 entries. Balances may be incomplete.</p>}
          {currencies.length === 0 || currencies.every((c) => costs.transfers[c]!.length === 0) ? (
            <p className="text-sm text-ink-soft">Everyone’s even. 🎉</p>
          ) : (
            currencies.map((cur) =>
              costs.transfers[cur]!.map((t) => (
                <div key={`${cur}-${t.from}-${t.to}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
                  <span className={t.from === me.id || t.to === me.id ? 'font-semibold' : ''}>
                    {name(t.from)} {t.from === me.id ? 'owe' : 'owes'} {name(t.to)} <strong>{formatMoney(t.amountMinor, cur)}</strong>
                  </span>
                  {(t.from === me.id || t.to === me.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settle.isPending}
                      onClick={() =>
                        confirm(`Record that ${name(t.from)} paid ${name(t.to)} ${formatMoney(t.amountMinor, cur)}?`) &&
                        settle.mutate(
                          { data: { from: t.from, to: t.to, amount: { amountMinor: t.amountMinor, currency: cur } } },
                          { onSuccess: () => toast.success('Marked as paid'), onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      Mark paid
                    </Button>
                  )}
                </div>
              )),
            )
          )}
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Expenses</h2>
        {costs.expenses.isLoading ? null : costs.expenses.items.length === 0 ? (
          <EmptyState emoji="🧾" title="No expenses yet">Add the first one and we’ll keep the score.</EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {costs.expenses.items.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.data.description}</div>
                  <div className="text-xs text-ink-soft">
                    {name(e.data.paidBy)} paid · split {e.data.splitAmong.length} ways · {format(new Date(e.createdAt), 'd MMM')}
                  </div>
                </div>
                <div className="font-bold">{formatMoney(e.data.amount.amountMinor, e.data.amount.currency)}</div>
                {(e.author?.id === me.id || isAdmin(me.role)) && (
                  <Button variant="ghost" size="icon" aria-label={`Delete ${e.data.description}`} onClick={() => confirm('Delete this expense?') && remove.mutate(e.id)}>
                    <Trash2 size={16} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {costs.settlements.items.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Payments</h2>
          <ul className="space-y-1 text-sm">
            {costs.settlements.items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>
                  {name(s.data.from)} paid {name(s.data.to)} <Badge>{formatMoney(s.data.amount.amountMinor, s.data.amount.currency)}</Badge>
                </span>
                {isAdmin(me.role) && (
                  <Button variant="ghost" size="sm" aria-label="Undo payment" onClick={() => remove.mutate(s.id)}>
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {adding && <ExpenseForm open onOpenChange={setAdding} defaultCurrency={defaultCurrency} />}
    </div>
  );
}
