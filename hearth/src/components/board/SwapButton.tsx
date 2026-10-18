'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { swapAction } from '@/app/r/[projectId]/board/actions';
import { CATEGORY_LABELS, type Category } from '@/lib/taxonomy';

/**
 * "Not quite, show me another": the next-best item in the same category, instantly (R28). Undo
 * lives in the grid, not here: this card is replaced by the swap, so it can't hold the undo.
 */
export function SwapButton({
  participantId,
  itemId,
  category,
  onSwapped,
}: {
  participantId: string;
  itemId: string;
  category: string;
  onSwapped: (swapId: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await swapAction(participantId, itemId);
            if (!res.ok) return setMessage(res.error);
            if (res.data.exhausted || !res.data.swapId) {
              setMessage(
                `That’s everything we have in ${CATEGORY_LABELS[category as Category]?.toLowerCase() ?? 'this category'} at this budget.`,
              );
              return;
            }
            onSwapped(res.data.swapId);
            router.refresh();
          })
        }
      >
        Not quite, show me another
      </button>
      {message ? (
        <p role="status" className="w-full text-xs text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
