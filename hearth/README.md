# Hearth

Hearth helps two to four people who share a home agree on a room's style in about five minutes.
Everyone swipes the same 30 cards (twelve whole rooms, then eighteen products). A synthesis engine
turns the swipes into one shared board: a named bridge style with evidence from each person,
products that work for everyone, a shopping list and a printable style brief.

The design is in [`PLAN.md`](../docs/house-design-app/PLAN.md) (Revision 4). This README covers what
is built, how to run it, and where this build departs from the plan.

## What works today

Everything below is covered by automated tests and has been driven end to end in a real browser.

- **Start a room** (living room, bedroom, dining room) with room context: what you're keeping,
  who lives there, tight spaces, budget. Or take the **solo style quiz**.
- **Invite by link or QR.** The second person types a first name and swipes: no account. Guests
  become Google users later without losing anything.
- **Three ways to do it:** send a link, two phones at once, or one phone passed around (with a
  handoff screen that hides the last person's progress).
- **The swipe deck:** drag, buttons and keyboard for every gesture, undo, card details, three
  vetoes that can name a deal-breaker, a first-run hint. Swipes queue on the phone and sync when the
  connection returns. A card whose image fails is replaced from reserves.
- **Your own style card** the moment you finish, without seeing anyone else's swipes.
- **A synchronised reveal:** the board appears on every phone at the same moment.
- **The board:** shared style and rationale, "where your tastes meet" with each person's cards as
  evidence (it works when there are zero exact matches), "what you each bring", compromise picks
  chosen so satisfaction stays balanced, anonymous deal-breakers, no scores anywhere.
- **On the board:** ❤️/🤔/✕ and a one-line note per item, "not quite, show me another" with undo,
  save for later, "we bought this", shopping list with a total against your budget band, an optional
  tie-breaker round, a printable style brief (and as an image), next room, feedback.
- **Housekeeping:** late joiners update the board, leaving or removal rebuilds it, start over,
  "see my board for now" when a partner stalls, rate limits, export and delete my data.
- **Revenue experiments:** affiliate links through `/go`, a "see it in your room" waiting list and a
  designers page. Both are clearly labelled as not built yet and take no payment details.

## Run it (no accounts or keys needed)

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

With no `DATABASE_URL`, Hearth uses **PGlite** (Postgres compiled to WASM, with pgvector) in
`.data/pglite`, migrates itself, and seeds a synthetic catalogue on first run (about 7 seconds). The
card art is generated placeholders, so you can try the whole flow offline.

Open it on two phones, or two browser profiles, to see the two-person flow. For one phone, pick
"Together, one phone".

### Production database

Set `DATABASE_URL` to a Postgres 16 URL with the `vector` extension (Neon works) and run
`pnpm db:migrate` on deploy. The same Drizzle schema runs on both.

### Environment variables

See [`.env.example`](.env.example). Only `DATABASE_URL` (in production) and `BETTER_AUTH_SECRET`
matter to start. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` turn on "Save with Google".
`ANTHROPIC_API_KEY` makes Claude write the style name and explanation; without it the wording is
plain and deterministic, and the board is otherwise identical. `CRON_SECRET` protects the nightly
routes in `vercel.json`. `RATE_LIMIT_MULTIPLIER` raises the rate limits for testing.

## Testing

```bash
pnpm test               # 85 unit tests: the engine and the catalogue pipeline, in milliseconds
pnpm test:integration   # 78 tests against in-memory PGlite: services, rules, permissions
pnpm test:e2e           # 19 Playwright tests, mobile viewport, real two-browser flows
```

`pnpm test:e2e` builds the app and starts it on port 3100 against an in-memory database. On a
machine with a pre-installed Chromium set `PW_CHROMIUM_PATH`.

The engine is deterministic, so the plan's regression cases are real tests: industrial vs minimalist
produces no exact matches but a shared style and evidence; everyone brings something; satisfaction
stays balanced; a kept sofa never appears; a dog changes the picks.

## How it fits together

```
src/lib/engine/     pure TypeScript: decks, taste profiles, bridge style, compromise picks
src/lib/*.ts        services: projects, swipes, reveal, synthesis, board, reactions, swaps, ...
src/db/             Drizzle schema (Postgres + pgvector); PGlite in development and tests
src/app/            Next 16 pages, server actions and route handlers
src/components/     UI, including the swipe deck and the board sections
src/lib/seed/       the synthetic catalogue used in development and tests
tests/              unit, integration (PGlite) and e2e (Playwright)
```

Two ideas to know before changing the engine:

- **All per-person maths is deterministic code.** The AI only writes the style's name and
  explanation, from labels, and its output is validated hard (no scores, no "who gave way", people
  and lengths checked). If it fails or misbehaves the board falls back to plain wording. The AI can
  never invent a match.
- **Affinity is measured against each person's own baseline**, not absolutely. Someone who says yes
  to everything doesn't "love" every attribute, and two people with disjoint tastes can still share
  an element. (This replaces the plan's absolute formula; see below.)

## Departures from the plan

Found by building it; the plan's text should be read with these in mind.

| Plan | What the build does, and why |
|---|---|
| §11.2 affinity `(k+1)/(n+2) − 0.5` | Lift over the person's own right-swipe rate. The absolute version let yes-to-everything swipers "love" everything and made shared elements impossible for people with different tastes. |
| Reactions trigger a recompute on the next visit | Reactions and swaps are inputs to the *next* recompute (tie-breaker, someone joining or leaving). Rebuilding on a page visit would reshuffle the board under people's eyes. |
| pgvector prefilter for compromise candidates | Candidates (a few hundred per room) are scored in memory. The vector column and HNSW index exist for the catalogue tools; they aren't needed at this size. |
| Invite tokens stored only as hashes | Also stored encrypted, so the creator can see the same link again without invalidating it. |
| shadcn/ui | A small set of Tailwind component classes and a native `<dialog>` sheet instead. |
| "Hide risky pieces" persisted in project context | A view-only filter on the board. The context is locked once the board is out. |
| First-run hint stored on the user | Stored in `localStorage`. |

## Not built yet

Being plain about it, so nobody assumes otherwise:

- **The live catalogue pipeline has not been run against real services.** The scripts for Unsplash
  photos, Awin product feeds, Claude tagging and Voyage embeddings are written against those APIs'
  documented shapes, but there were no keys in the build environment, so only the pure parts
  (parsing, mapping, validation) are tested. Expect to debug the first real run.
- Real card art and a curated catalogue (the plan's biggest job), and affiliate approvals.
- Email: board-ready email, emailed shopping list, price-drop alerts, one-click unsubscribe.
- Public share pages and share images, partner landing pages, SEO style pages, `/admin`.
- Analytics (PostHog), error monitoring (Sentry), Google sign-in has not been exercised against a
  real Google client.
- The unbuilt revenue features themselves ("see it in your room", the designer plan).

And Phase −1 of the plan, the no-code validation with real couples, is still the right first step
before spending on any of the above.
