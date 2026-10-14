# Brock 🪨📄✂️

Rock paper scissors, once a day. Win and your streak grows by 1. Lose, or skip a day, and it resets to 0. Streaks are ranked on a global leaderboard.

The full design is in [`PLAN.md`](./PLAN.md). This README covers running, testing and deploying it.

## The rules

|              |                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opponent     | **The House**: a server-side pick, uniformly random (`crypto.randomInt`)                                                                                                                             |
| A "day"      | A **UTC calendar day** (resets 00:00 UTC). The countdown shows the time left.                                                                                                                        |
| Win          | Streak +1                                                                                                                                                                                            |
| Loss         | Streak → 0                                                                                                                                                                                           |
| Draw         | Throw again, the same day. A draw doesn't use up your Brock.                                                                                                                                         |
| Missed day   | Streak → 0                                                                                                                                                                                           |
| Fairness     | The House's throw is committed to before you throw: you see `sha256("<throw>:<salt>")` first, and the throw and salt are revealed afterwards. "Verify fairness" recomputes the hash in your browser. |
| Leaderboard  | Current streak ↓, then best streak ↓, then handle A→Z. Ties share a rank.                                                                                                                            |
| Brock number | Days since `LAUNCH_DAY` (Brock #1 is launch day)                                                                                                                                                     |

The rules live in `src/lib/` (`game.ts`, `day.ts`, `streak.ts`, `fairness.ts`), so changing them means changing one file each.

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · PostgreSQL 16 · Drizzle ORM · Better Auth (Google + GitHub) · Zod · Vitest · Playwright · GitHub Actions · Vercel + Neon.

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

| Variable                                    | Purpose                                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Postgres connection string for the app                                                                                                                                                                         |
| `TEST_DATABASE_URL`                         | A _separate_ database that integration and E2E tests wipe                                                                                                                                                      |
| `BETTER_AUTH_SECRET`                        | Session signing secret: `openssl rand -base64 32`                                                                                                                                                              |
| `BETTER_AUTH_URL`                           | Public base URL of the app                                                                                                                                                                                     |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app                                                                                                                                                                                               |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client                                                                                                                                                                                            |
| `LAUNCH_DAY`                                | `YYYY-MM-DD` of Brock #1                                                                                                                                                                                       |
| `NEXT_PUBLIC_SITE_URL`                      | Public URL, used in metadata and share text                                                                                                                                                                    |
| `E2E_TEST_AUTH`                             | **Tests only.** Enables email/password sign-in for Playwright. Auth refuses to initialise with it on unless `BETTER_AUTH_URL` is loopback, and never on Vercel production. It also switches off rate limiting. |

A provider's sign-in button only appears when both of its variables are set.

### OAuth apps

- **GitHub**: Settings → Developer settings → OAuth Apps → New. Callback URL: `<BETTER_AUTH_URL>/api/auth/callback/github`
- **Google**: Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`

Register a second callback for each provider with your production URL when you deploy.

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

Everything that matters happens inside one transaction holding a row lock on the player's Brock for the day (`src/lib/brock-service.ts`), backed by `UNIQUE (user_id, day)`. Two tabs submitting at once can't both count, and nobody can play twice in a day. The House's throw and salt stay on the server until the player's throw is saved. API responses are built in one place (`buildState`) so an open round can only ever expose its hash.

## Deploying (Vercel + Neon)

1. Create a Neon project and copy the **pooled** connection string.
2. Import the repo into Vercel. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production URL), `NEXT_PUBLIC_SITE_URL`, `LAUNCH_DAY`, and the OAuth variables. **Don't** set `TEST_DATABASE_URL` or `E2E_TEST_AUTH`.
3. Add the production callback URLs to the GitHub and Google OAuth apps.
4. Run the migrations against Neon: `DATABASE_URL='<neon url>' pnpm db:migrate`
5. Deploy. The first player to win gets Brock #1's streak.

## Project layout

```
src/app/          pages and API routes (/, /leaderboard, /onboarding, /u/[handle], /api/*)
src/components/   UI (BrockGame is the main client component)
src/lib/          game rules, services, auth, validation
src/db/           Drizzle schema and client
drizzle/          generated migrations (never hand-edit)
tests/            unit, integration, e2e
```

## Known limitations

- One person can make several accounts through different OAuth providers to farm streaks. Fine for a friends game. If it ever matters, restrict to one provider or add an admin ban tool.
- Better Auth's rate limiter keeps counters in memory, so on serverless hosting limits apply per instance. If you need hard limits, switch to `rateLimit.storage: "database"` (this needs an extra `rateLimit` table; see the Better Auth docs).
