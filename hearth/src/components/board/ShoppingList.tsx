'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { boughtAction } from '@/app/r/[projectId]/board/actions';
import type { BoardView } from '@/lib/board';
import { formatPrice } from '@/lib/locale';

const SOURCE: Record<string, string> = {
  agreed: 'Agreed',
  tiebreak: 'Agreed in the tie-breaker',
  loved: 'You all loved it',
  saved: 'Saved',
};

/** What you've agreed to buy, the total against your budget, and "we bought this" (R25, R34). */
export function ShoppingList({
  board,
  participantId,
}: {
  board: BoardView;
  participantId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const { shopping, items, total, project } = board;
  if (shopping.length === 0) return null;

  const budget =
    total.budgetPence != null
      ? `${formatPrice(total.pence)} of about ${formatPrice(total.budgetPence)}`
      : project.budgetBand
        ? `${formatPrice(total.pence)} so far`
        : formatPrice(total.pence);

  const text = shopping
    .map((s) => items[s.itemId])
    .filter(Boolean)
    .map((i) => `${i.title}${i.pricePence ? ` (${formatPrice(i.pricePence)})` : ''}`)
    .join('\n');

  return (
    <section className="flex flex-col gap-3" aria-labelledby="shopping">
      <div className="flex items-end justify-between gap-3">
        <h2 id="shopping" className="text-2xl font-bold">
          Your shopping list
        </h2>
        <p className="text-sm font-semibold" aria-label="Total">
          {budget}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {shopping.map((s) => {
          const item = items[s.itemId];
          if (!item) return null;
          return (
            <li key={s.itemId} className="card flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span
                  className={`block truncate font-semibold ${s.bought ? 'line-through opacity-60' : ''}`}
                >
                  {item.title}
                </span>
                <span className="text-xs text-muted">
                  {SOURCE[s.source] ?? s.source} · {formatPrice(item.pricePence)}
                </span>
              </span>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-clay"
                  checked={s.bought}
                  disabled={pending}
                  onChange={(e) =>
                    start(async () => {
                      await boughtAction(participantId, s.itemId, e.target.checked);
                      router.refresh();
                    })
                  }
                />
                We bought this
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn btn-secondary btn-sm self-start"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied' : 'Copy the list'}
      </button>
    </section>
  );
}
