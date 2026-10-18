# Brock 🪨📄✂️

Rock paper scissors against the House, one run a day. Win and you keep going; your first loss ends the run. Today's runs and everyone's best runs are ranked on a global leaderboard. There are no accounts: play straight away, and pick a name once your first run ends.

The original design is in [`PLAN.md`](./PLAN.md) (see Revisions 5 and 6 at the top for how the rules changed). This README covers the current rules, running, testing and deploying.

## The rules

|                  |                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opponent         | **The House**: a server-side pick, uniformly random (`crypto.randomInt`)                                                                                                                                                                                                                                                         |
| A "day"          | A **UTC calendar day** (resets 00:00 UTC). The countdown shows the time left.                                                                                                                                                                                                                                                    |
| A run            | One per day. Each win adds 1 to the run's score and you throw again.                                                                                                                                                                                                                                                             |
| Draw             | Throw again. A draw neither scores nor ends the run.                                                                                                                                                                                                                                                                             |
| Loss             | Ends the run. Its score stands for the day.                                                                                                                                                                                                                                                                                      |
| Win another life | Once the run ends, you can try once a day: 5 multiple-choice questions (pub-quiz level) about rocks, paper and scissors (all three themes appear), 15 seconds each, enforced by the server. Nothing says right or wrong until all 5 are answered. 5/5 reopens the run with its score kept; anything less and the run stays over. |
| Risk it all      | Once the quiz’s extra life has been won and lost too, you can risk the run on one more Brock, once a day. Win and the run carries on from its score (that Brock doesn’t add a point). Lose and the day scores 0, and your all-time best drops back to your best other day if today was it.                                       |
| Armour           | Cosmetic only: your hand levels up every 2 wins in a run: bronze at 2, steel with a wrist blade at 4, gold with a broadsword at 6, legendary obsidian with a flaming sword at 8.                                                                                                                                                 |
| Fairness         | The House's throw is committed to before you throw: you see `sha256("<throw>:<salt>")` first, and the throw and salt are revealed afterwards. "Verify fairness" recomputes the hash in your browser.                                                                                                                             |
| Leaderboards     | Named players only. **Today**: today's runs by score (runs still going are marked live). **All-time**: each player's best run. Ties share a rank.                                                                                                                                                                                |
| Identity         | No login. Each browser gets a secret cookie that remembers you. After your first finished run you pick a username. On another device, type that username at `/login` to carry on.                                                                                                                                                |
| Brock number     | Days since `LAUNCH_DAY` (Brock #1 is launch day)                                                                                                                                                                                                                                                                                 |

The rules live in `src/lib/` (`game.ts`, `day.ts`, `fairness.ts`, `trivia/quiz.ts`) and the service that applies them is `src/lib/brock-service.ts`.

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · PostgreSQL 16 · Drizzle ORM · Zod · Vitest · Playwright · GitHub Actions · Vercel + Neon.

## Getting started

Requires Node ≥ 22 (`.nvmrc` pins 24), pnpm 10 and PostgreSQL 16.

```bash
pnpm install
cp .env.example .env          # then fill it in, see below
pnpm db:up                    # Postgres via Docker Compose: dev on :5432, tests on :5433
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

No Docker? Any Postgres 16 works. Create the `brock` and `brock_test` databases and point `DATABASE_URL` and `TEST_DATABASE_URL` at them.

### Environment variables

| Variable                      | Purpose                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Postgres connection string for the app                                                                        |
| `TEST_DATABASE_URL`           | A _separate_ database that integration and E2E tests wipe                                                     |
| `LAUNCH_DAY`                  | `YYYY-MM-DD` of Brock #1                                                                                      |
| `NEXT_PUBLIC_SITE_URL`        | Public URL, used in metadata and share text. An `https://` value also makes the identity cookie `Secure`.     |
| `MAX_NEW_PLAYERS_PER_IP_HOUR` | Optional. New anonymous players one IP may create per hour (default 30). Raise it for events on shared Wi-Fi. |

There are no secrets to configure beyond the database URL.

## How identity works

- The first time a browser opens the game, the server creates an anonymous player and sets an `httpOnly`, `SameSite=Lax` cookie (`brock_id`, about a year) holding a random 256-bit token. Only the token's SHA-256 is stored, so a database leak can't be used to impersonate anyone.
- A name can only be claimed after a finished Brock, once, and is unique ignoring case.
- `/login` logs a browser in as a named player by username alone, with no password. Each browser gets its own token (table `player_session`), so logging in on a new device doesn't log out the old one. Logins are limited to 30 per IP per 15 minutes.

## Scripts

| Script                               | What it does                                                           |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`       | Next.js                                                                |
| `pnpm lint` / `typecheck` / `format` | ESLint, `tsc --noEmit`, Prettier                                       |
| `pnpm db:up`                         | Start Postgres containers                                              |
| `pnpm db:generate`                   | Generate a migration after editing `src/db/schema.ts`                  |
| `pnpm db:migrate`                    | Apply migrations to `DATABASE_URL`                                     |
| `pnpm db:studio`                     | Browse the database                                                    |
| `pnpm test`                          | Unit tests (no database needed)                                        |
| `pnpm test:integration`              | Service-layer tests against real Postgres (`TEST_DATABASE_URL`)        |
| `pnpm test:e2e`                      | Playwright: builds the app, runs it on :3100 against the test database |

If a Chromium is already installed (e.g. in a container), point Playwright at it with `PW_CHROMIUM_PATH=/path/to/chromium pnpm test:e2e`. Otherwise run `pnpm exec playwright install chromium` once.

## How one Brock stays fair

Everything that matters happens inside one transaction holding a row lock on the player's run for the day (`src/lib/brock-service.ts`), backed by `UNIQUE (player_id, day)`. Two tabs submitting at once can't both count, and nobody can start a second run in a day. The House's throw and salt stay on the server until the player's throw is saved. API responses are built in one place (`buildState`) so an open round can only ever expose its hash.

## Deploying (Vercel + Neon)

1. Create a Neon project and copy the **pooled** connection string.
2. Import the repo into Vercel. Set `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` (the production `https://` URL) and `LAUNCH_DAY`. **Don't** set `TEST_DATABASE_URL`.
3. Deploy. Vercel runs the `vercel-build` script: on **production** deploys it applies any new database migrations, then builds, so schema changes go live with the code that needs them. No OAuth apps or secrets are needed.

Preview deployments never run migrations (they share `DATABASE_URL` with production, so a preview that migrated would change the live database under the live code). A branch that changes the schema therefore can't be fully tried on its preview URL; give previews their own Neon branch if you need that.

## Project layout

```
src/app/          pages and API routes (/, /leaderboard, /login, /u/[handle], /api/*)
src/components/   UI (BrockGame is the main client component)
src/lib/          game rules, services, identity, validation
src/db/           Drizzle schema and client
drizzle/          generated migrations (never hand-edit)
tests/            unit, integration, e2e
```

## The life quiz

- **Questions** live in `src/lib/trivia/questions.ts`: 125 pub-quiz-level questions themed on rock (rocks and gems, famous rocks, rock music), paper (books, newspapers, money, stationery) and scissors (the game itself, hairdressing, sewing, blades). Each has a stable `id`, one answer and three wrong options. Add questions with new ids and never reuse an old one. A player doesn't see a question twice until they've seen the rest of that theme, which takes a few weeks of daily quizzes.
- **Fairness:** the five questions and their shuffled options are fixed when the quiz starts. The answers never reach the browser until all five are answered. Reloading returns the same question with the time that's left, so nothing can be rerolled.
- **Timer:** each question gets 15 seconds from when it appears, plus a 1.5-second network grace, checked on the server. A late answer counts as wrong. An abandoned question is closed as wrong on the next visit, and the next one starts.
- **Data:** one `brock_quiz` row per run, keyed by the run, so there is at most one quiz a day (migration `0003_daily_runs`). The risk is the `brock.risk` column (migration `0004_risk_it`).

## Known limitations

- **Anyone can play as anyone.** Logging in needs only a username, by design: it's a casual game and convenience wins. Someone who knows your name can play your Brock for you. If that ever matters, a passkey or a PIN per player would be the next step.
- **Identity is a cookie.** Clearing site data, switching browser or using a private window starts a new anonymous player until you log in with your username. Unnamed players can't get their Brock back, but they have nothing on the leaderboard to lose.
- **One person can play as many players** by using several browsers, and could farm quiz attempts that way. Fine for a friends game. Handle claims need a finished Brock and new players are limited per IP, which slows it down but doesn't stop it.
- **Rate limits are in memory**, so on serverless hosting each instance counts separately. They slow abuse down; they're not a hard guarantee.
