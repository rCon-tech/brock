import { COLOUR_HEX, attributeLabel } from '@/lib/taxonomy';
import type { PersonalResult } from '@/lib/personal-result';

/** The reward for finishing: your own style, in one card (R23). */
export function MyStyleCard({ result, name }: { result: PersonalResult; name: string }) {
  return (
    <section className="card flex flex-col gap-4 bg-blush/50 p-6" aria-labelledby="my-style">
      <p className="eyebrow">{name}’s style</p>
      <h2 id="my-style" className="text-3xl leading-tight font-bold">
        {result.sentence}
      </h2>
      {result.palette.length > 0 ? (
        <ul className="flex gap-2" aria-label="Your colours">
          {result.palette.map((c) => (
            <li key={c} className="flex flex-col items-center gap-1 text-xs text-muted">
              <span
                className="h-10 w-10 rounded-full border border-ink/10"
                style={{ background: COLOUR_HEX[c] ?? '#ccc' }}
              />
              {attributeLabel(c)}
            </li>
          ))}
        </ul>
      ) : null}
      {result.materials.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your materials">
          {result.materials.map((m) => (
            <li key={m} className="chip">
              {attributeLabel(m)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
