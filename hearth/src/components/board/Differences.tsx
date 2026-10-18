import type { BoardView } from '@/lib/board';
import { attributeLabel } from '@/lib/taxonomy';

/** Where you differ (named neutrally) and what's off the table (anonymous on purpose, R22). */
export function Differences({ board }: { board: BoardView }) {
  const { result } = board;
  if (result.solo || (result.conflicts.length === 0 && result.vetoedAttributes.length === 0))
    return null;
  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Differences and deal-breakers">
      {result.conflicts.length > 0 ? (
        <div className="card flex flex-col gap-2 p-4">
          <h2 className="text-lg font-bold">Worth talking about</h2>
          <p className="text-sm text-muted">You see these a little differently.</p>
          <ul className="flex flex-wrap gap-1.5">
            {result.conflicts.map((c) => (
              <li key={c.attribute} className="chip">
                {attributeLabel(c.attribute)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.vetoedAttributes.length > 0 ? (
        <div className="card flex flex-col gap-2 p-4">
          <h2 className="text-lg font-bold">Off the table</h2>
          <p className="text-sm text-muted">Nothing here has these.</p>
          <ul className="flex flex-wrap gap-1.5">
            {result.vetoedAttributes.map((a) => (
              <li key={a} className="chip chip-clay">
                {attributeLabel(a)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
