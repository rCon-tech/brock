'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { swapAction, undoSwapAction } from '@/app/r/[projectId]/board/actions';
import { CATEGORY_LABELS, type Category } from '@/lib/taxonomy';

const UNDO_MS = 10_000;

/** "Not quite, show me another": the next-best item in the same category, instantly (R28). */
export function SwapButton({
  participantId,
  itemId,
  category,
}: {
  participantId: string;
  itemId: string;
  category: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [undo, setUndo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

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
            if (res.data.exhausted) {
              setMessage(
                `That’s everything we have in ${CATEGORY_LABELS[category as Category]?.toLowerCase() ?? 'this category'} at this budget.`,
              );
              return;
            }
            setUndo(res.data.swapId);
            timer.current = setTimeout(() => setUndo(null), UNDO_MS);
            router.refresh();
          })
        }
      >
        Not quite, show me another
      </button>
      {undo ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            start(async () => {
              await undoSwapAction(participantId, undo);
              setUndo(null);
              router.refresh();
            })
          }
        >
          Undo
        </button>
      ) : null}
      {message ? (
        <p role="status" className="w-full text-xs text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
