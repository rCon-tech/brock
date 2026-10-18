'use client';

import { useState } from 'react';
import { ItemReactions } from '@/components/board/ItemReactions';
import { SaveButton } from '@/components/board/SaveButton';
import { SwapButton } from '@/components/board/SwapButton';
import { ProductCard } from '@/components/ProductCard';
import type { BoardView } from '@/lib/board';

interface Props {
  board: BoardView;
  participantId: string;
  /** Which items to show, in order. */
  itemIds: string[];
  /** Picks can be swapped for the next best; agreed items can't. */
  swappable?: boolean;
  /** Offer the "hide pieces that may not suit pets or kids" switch (R15). */
  riskFilter?: boolean;
  empty?: string;
}

const RISK_TEXT = { pets: 'May not suit pets', kids: 'May not suit young kids' } as const;

export function ProductGrid({
  board,
  participantId,
  itemIds,
  swappable,
  riskFilter,
  empty,
}: Props) {
  const [hideRisky, setHideRisky] = useState(false);
  const { items, result, reactions, shopping, participants, project } = board;
  const picks = new Map(result.picks.map((p) => [p.itemId, p]));
  const names = new Map(participants.map((p) => [p.id, p.name]));
  const visible = itemIds.filter((id) => items[id] && !board.notForUs.includes(id));
  const shown = hideRisky
    ? visible.filter((id) => (picks.get(id)?.householdRisks.length ?? 0) === 0)
    : visible;
  const anyRisky = visible.some((id) => (picks.get(id)?.householdRisks.length ?? 0) > 0);

  if (visible.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;

  return (
    <div className="flex flex-col gap-3">
      {riskFilter && anyRisky ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-clay"
            checked={hideRisky}
            onChange={(e) => setHideRisky(e.target.checked)}
          />
          Hide pieces that may not suit your household
        </label>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((id) => {
          const item = items[id];
          const pick = picks.get(id);
          const mine = reactions[id]?.find((r) => r.participantId === participantId);
          const others = (reactions[id] ?? [])
            .filter((r) => r.participantId !== participantId)
            .map((r) => ({
              name: names.get(r.participantId) ?? 'Someone',
              reaction: r.reaction,
              note: r.note,
            }));
          const checkSize = project.context.maxSize.some(
            (m) =>
              m.category === item.category &&
              ((m.widthCm && item.widthCm == null) || (m.depthCm && item.depthCm == null)),
          );
          return (
            <li key={id}>
              <ProductCard
                item={item}
                buyHref={`/go/${id}?s=board&p=${project.id}&a=${participantId}`}
                checkSize={checkSize}
                badges={[
                  ...(pick?.goesWith
                    ? [{ text: `Goes with your ${pick.goesWith}`, tone: 'sage' as const }]
                    : []),
                  ...(pick?.householdRisks ?? []).map((r) => ({
                    text: RISK_TEXT[r],
                    tone: 'clay' as const,
                  })),
                ]}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <SaveButton
                    participantId={participantId}
                    itemId={id}
                    saved={shopping.some((s) => s.itemId === id)}
                  />
                  {swappable && pick ? (
                    <SwapButton
                      participantId={participantId}
                      itemId={id}
                      category={pick.category}
                    />
                  ) : null}
                </div>
                <ItemReactions
                  participantId={participantId}
                  itemId={id}
                  mine={mine}
                  others={others}
                />
              </ProductCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
