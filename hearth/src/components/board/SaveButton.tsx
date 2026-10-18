'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { savedAction } from '@/app/r/[projectId]/board/actions';

/** Keep a suggestion on the shopping list without needing anyone else to agree. */
export function SaveButton({
  participantId,
  itemId,
  saved,
}: {
  participantId: string;
  itemId: string;
  saved: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-ghost'}`}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await savedAction(participantId, itemId, next);
          if (!res.ok) setOn(!next);
          else router.refresh();
        });
      }}
    >
      {on ? 'Saved ✓' : 'Save for later'}
    </button>
  );
}
