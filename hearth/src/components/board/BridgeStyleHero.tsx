import { CardImage } from '@/components/CardImage';
import type { BoardView } from '@/lib/board';
import { COLOUR_HEX, attributeLabel } from '@/lib/taxonomy';

/** The headline: the shared style, what it means, and rooms that look like it. */
export function BridgeStyleHero({ board }: { board: BoardView }) {
  const { naming, result, items } = board;
  const eyebrow = result.solo
    ? 'Your style, for now'
    : result.alreadyAgree
      ? 'You already agree'
      : 'Your shared style';
  return (
    <section className="card flex flex-col gap-4 bg-blush/50 p-6" aria-labelledby="bridge-name">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="bridge-name" className="text-4xl leading-tight font-bold sm:text-5xl">
        {naming.name}
      </h1>
      <p className="font-display text-xl text-clay-dark">{naming.tagline}</p>
      <p>{naming.rationale}</p>
      {!naming.ready ? <p className="text-xs text-muted">Polishing the wording…</p> : null}
      {result.palette.length > 0 ? (
        <ul className="flex flex-wrap gap-3" aria-label="Colour palette">
          {result.palette.map((c) => (
            <li key={c} className="flex flex-col items-center gap-1 text-xs text-muted">
              <span
                className="h-11 w-11 rounded-full border border-ink/10"
                style={{ background: COLOUR_HEX[c] ?? '#ccc' }}
              />
              {attributeLabel(c)}
            </li>
          ))}
        </ul>
      ) : null}
      {result.materials.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Materials">
          {result.materials.map((m) => (
            <li key={m} className="chip">
              {attributeLabel(m)}
            </li>
          ))}
        </ul>
      ) : null}
      {result.hybridRooms.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Rooms in this style</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {result.hybridRooms.map((id) =>
              items[id] ? (
                <li key={id} className="overflow-hidden rounded-xl bg-sand">
                  <CardImage
                    src={items[id].imageUrl}
                    alt={items[id].title}
                    className="aspect-[4/5] w-full object-cover"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
