import { CardImage } from '@/components/CardImage';
import type { BoardView } from '@/lib/board';
import { attributeLabel } from '@/lib/taxonomy';

/**
 * Where your tastes meet, with proof (R19): for each shared element, the cards each person said
 * yes to. This is what carries the board when there are no exact matches.
 */
export function EvidenceStrip({ board }: { board: BoardView }) {
  const { result, items, participants } = board;
  if (result.shared.length === 0) return null;
  const names = new Map(participants.map((p) => [p.id, p.name]));
  const heading = result.solo ? 'What you keep coming back to' : 'Where your tastes meet';
  return (
    <section className="flex flex-col gap-3" aria-labelledby="evidence">
      <div>
        <h2 id="evidence" className="text-2xl font-bold">
          {heading}
        </h2>
        {!result.solo && result.exactMicro.length < 3 ? (
          <p className="text-sm text-muted">
            It’s normal not to pick the very same pieces from 30 cards. Here’s what you each said
            yes to that points the same way.
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-3">
        {result.shared.slice(0, 4).map((s) => (
          <li key={s.attribute} className="card flex flex-col gap-2 p-3">
            <p className="font-semibold">
              {result.solo ? 'You like' : 'You both like'}{' '}
              <span className="text-clay-dark">{attributeLabel(s.attribute)}</span>
            </p>
            {Object.entries(s.evidence).map(([pid, ids]) => (
              <div key={pid} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs text-muted">
                  {names.get(pid) ?? 'Someone'}
                </span>
                <ul className="flex gap-1.5">
                  {ids.map((id) =>
                    items[id] ? (
                      <li key={id} className="h-14 w-14 overflow-hidden rounded-lg bg-sand">
                        <CardImage
                          src={items[id].imageUrl}
                          alt={items[id].title}
                          className="h-full w-full object-cover"
                        />
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {result.shared.length > 4 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="More things you share">
          {result.shared.slice(4).map((s) => (
            <li key={s.attribute} className="chip chip-sage">
              {attributeLabel(s.attribute)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
