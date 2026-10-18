import Link from 'next/link';

const STEPS = [
  {
    n: '1',
    title: 'Swipe together',
    body: 'Each of you swipes the same 30 cards: whole rooms, then sofas, rugs and lamps. About three minutes. No sign-up for your partner.',
  },
  {
    n: '2',
    title: 'See where you meet',
    body: 'Hearth finds what you both love, even when your styles clash, and names a style that gives each of you something.',
  },
  {
    n: '3',
    title: 'Shop what you agree on',
    body: 'Get a shared board, a list of pieces that work for both of you, and a one-page brief to take to the shop.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5 pt-4">
        <p className="eyebrow">For couples, housemates and families</p>
        <h1 className="text-4xl leading-[1.1] font-bold sm:text-5xl">
          Settle your room style together in five minutes.
        </h1>
        <p className="text-lg text-muted">
          One of you likes industrial, the other likes minimal? Hearth finds the style in between
          and the pieces you can both live with.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/start" className="btn btn-primary">
            Start together
          </Link>
          <Link href="/quiz" className="btn btn-secondary">
            Take the style quiz on your own
          </Link>
        </div>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-4">
        <h2 id="how" className="text-2xl font-bold">
          How it works
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card flex gap-4 p-4">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush font-display text-lg font-bold text-clay-dark"
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card bg-sage-soft p-5">
        <h2 className="text-xl font-bold">Nobody wins and nobody loses</h2>
        <p className="mt-1 text-sm text-muted">
          There are no scores and no “who compromised more”. You each see what you bring to the
          shared style, and you can veto the things you really can’t live with.
        </p>
      </section>
    </div>
  );
}
