import type { BoardView } from '@/lib/board';

/** Everyone sees something of theirs in the shared style (R21). No comparison, no scores. */
export function WhatYouEachBring({ board }: { board: BoardView }) {
  const { naming, participants, result } = board;
  if (result.solo || naming.contributions.length === 0) return null;
  const names = new Map(participants.map((p) => [p.id, p.name]));
  return (
    <section className="flex flex-col gap-3" aria-labelledby="bring">
      <h2 id="bring" className="text-2xl font-bold">
        What you each bring
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {naming.contributions.map((c) => (
          <li key={c.participantId} className="card flex flex-col gap-1 p-3">
            <span className="font-semibold">{names.get(c.participantId) ?? 'Someone'}</span>
            <span className="text-sm text-muted">{c.brings}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
