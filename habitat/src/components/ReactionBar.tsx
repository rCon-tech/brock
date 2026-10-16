'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { REACTIONS } from '@/db/schema';
import { cn } from '@/lib/utils';
import { useHabitat } from '@/modules/sdk/context';

/** The six reactions (H11). Toggling is optimistic and rolls back on error. */
export function ReactionBar({
  recordId,
  counts,
  mine,
}: {
  recordId: string;
  counts: Record<string, number>;
  mine: string[];
}) {
  const { habitatId } = useHabitat();
  const qc = useQueryClient();
  // While a toggle is in flight we show our own optimistic copy; afterwards the server's numbers win.
  const [optimistic, setOptimistic] = useState<{
    counts: Record<string, number>;
    mine: string[];
  } | null>(null);
  const state = optimistic ?? { counts, mine };

  const toggle = useMutation({
    mutationFn: ({ emoji, on }: { emoji: string; on: boolean }) =>
      apiFetch(`/api/habitats/${habitatId}/records/${recordId}/reactions`, {
        method: on ? 'PUT' : 'DELETE',
        body: { emoji },
      }),
    onMutate: ({ emoji, on }) => {
      setOptimistic({
        counts: {
          ...state.counts,
          [emoji]: Math.max(0, (state.counts[emoji] ?? 0) + (on ? 1 : -1)),
        },
        mine: on ? [...state.mine, emoji] : state.mine.filter((e) => e !== emoji),
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'records'] }),
        qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'timeline'] }),
        qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'record'] }),
      ]);
      setOptimistic(null);
    },
  });

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Reactions">
      {REACTIONS.map((emoji) => {
        const n = state.counts[emoji] ?? 0;
        const on = state.mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={on}
            aria-label={`${emoji} ${n}`}
            onClick={() => toggle.mutate({ emoji, on: !on })}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full border px-2 text-sm transition',
              on ? 'border-accent bg-accent/15' : 'border-line hover:bg-surface-2',
              n === 0 && !on && 'opacity-60',
            )}
          >
            <span aria-hidden>{emoji}</span>
            {n > 0 && <span className="text-xs font-semibold">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
