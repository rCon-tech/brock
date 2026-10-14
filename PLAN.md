# Brock — Build Plan

> **Revision 3 (supersedes the recovery codes in Revision 2).** Recovery codes are gone. A returning player on a new device types their username on `/login` and carries on, with no password. Browser tokens moved from `player.token_hash` to a `player_session` table so one player can be logged in on several devices; migration `0001_player_sessions` copies existing tokens across so nobody is logged out. Vercel's `vercel-build` script now applies migrations on deploy.

> **Revision 2 (supersedes the sign-in parts of this plan).** Instead of Google/GitHub sign-in, players are anonymous and remembered by a secret cookie. They pick a handle *after* their first finished Brock and receive a one-time recovery code to restore their streak on another device. Consequently: Better Auth, the OAuth providers, the `user`/`session`/`account`/`verification` tables, `/onboarding` and `E2E_TEST_AUTH` are gone; `player` is now keyed by its own id with a hashed token and a nullable handle; new `/recover` page and `/api/player/{handle,recover}` routes; the leaderboard shows named players only. Everything else (rules, fairness, streaks, API for `/api/brock/*`) is unchanged. See `README.md` for the current design.

**Brock** is a daily rock-paper-scissors game. Every player gets one Brock per day against the house. A win adds 1 to your streak, a loss resets it to 0, and a global leaderboard ranks everyone by their current streak.

This document covers everything needed to build v1: the rules, the technology, every file, the data model, the API, and the build order. No code exists yet. Each phase below ends with acceptance criteria, so whoever builds it knows when a phase is finished.

---

## 1. Game rules (decide these first)

These defaults turn "once a day, win adds to your streak" into exact rules. Every one of them is isolated in `src/lib/` so it can be changed in one place. Read them before building and change anything that doesn't match how your group actually plays.

| # | Rule | Default | Why |
|---|------|---------|-----|
| R1 | Who you play | **The House**, a server-side opponent that picks uniformly at random | Everyone has the same odds, and nobody waits on an opponent being online. Async player-vs-player is in §11. |
| R2 | What a "day" is | **UTC calendar day** (resets 00:00 UTC) | A global leaderboard needs one shared clock. A countdown to the reset is shown in the player's local time. |
| R3 | Win | Streak +1 | — |
| R4 | Loss | Streak → 0 | — |
| R5 | Draw | **Throw again**, as many times as it takes, the same day | That's how real RPS works. A draw doesn't use up your daily Brock. |
| R6 | Missed day | Streak → 0 (you have to Brock every day) | Without this, a streak never has to be defended. |
| R7 | Fairness | **Commit–reveal**: the House's throw is locked in and its SHA-256 hash is shown *before* you throw. The throw and salt are revealed afterwards so anyone can check the hash. | Friends will accuse the server of cheating. This proves it didn't. |
| R8 | Leaderboard order | Current streak ↓, then best-ever streak ↓, then handle A→Z. Tied streaks share a rank. | — |
| R9 | Brock number | Days since launch day (e.g. "Brock #42"), used in share text | Wordle-style sharing. |

---

## 2. Technology (every piece)

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Language | **TypeScript** | 5.x, `strict: true` | One language for client, server and tests |
| Runtime | **Node.js** | 24 LTS (pinned in `.nvmrc`) | Server runtime, locally and on Vercel |
| Package manager | **pnpm** | 10.x | Fast, strict installs. The lockfile is committed. |
| Framework | **Next.js** (App Router) | 16.x | Pages, server components and API route handlers in one app |
| UI library | **React** | 19.x | Comes with Next.js |
| Styling | **Tailwind CSS** | 4.x (with `@tailwindcss/postcss`) | Utility CSS. No separate config file in v4. |
| Database | **PostgreSQL** | 16+ | Durable data, transactions and row locks for the one-Brock-per-day rule |
| Hosted DB | **Neon** (serverless Postgres) | — | Free tier, works with Vercel. Supabase or RDS would also work. |
| Local DB | **Docker Compose** running `postgres:16` | — | Same engine for local dev and integration tests |
| ORM / migrations | **Drizzle ORM** + **drizzle-kit** | latest | Type-safe SQL and generated migrations |
| DB driver | **postgres** (postgres.js) | 3.x | TCP driver that supports `SELECT … FOR UPDATE` in transactions |
| Auth | **Better Auth** (Drizzle adapter) | 1.x | Google and GitHub OAuth sign-in, sessions and built-in rate limiting |
| Validation | **Zod** | 4.x | Validates request bodies and handle input |
| Crypto | Node **`crypto`** (built in) | — | `randomInt` for the House's throw, `randomBytes` for salts, `createHash('sha256')` for commits |
| Unit and integration tests | **Vitest** | 3.x | Tests the pure game and streak logic, plus the service layer against real Postgres |
| End-to-end tests | **Playwright** (`@playwright/test`) | latest | Plays a full Brock in a real browser |
| Lint / format | **ESLint** (flat config, `eslint-config-next`) + **Prettier** | latest | Keeps code consistent |
| CI | **GitHub Actions** | — | Lint, typecheck, unit tests, integration tests (Postgres service container) and E2E on every PR |
| Hosting | **Vercel** | — | Zero-config Next.js deploys. PRs get preview URLs. |

The browser's `navigator.clipboard` and `navigator.share` handle the share button, and `Intl.DateTimeFormat` handles the local-time countdown. Neither needs a library.

**Not used, on purpose:** no Redis (the database row lock is the concurrency control), no websockets (nothing is real-time), no cron jobs (streak expiry is worked out when a streak is read, see §5), and no global state library.

---

## 3. Every file to create

```
brock/
├── .github/
│   └── workflows/
│       └── ci.yml                         # Lint, typecheck, unit, integration (pg service), e2e
├── drizzle/                               # GENERATED by `pnpm db:generate`; never hand-edit
│   ├── 0000_initial.sql
│   └── meta/                              # drizzle-kit snapshots (generated)
├── public/
│   ├── favicon.ico
│   └── og.png                             # 1200×630 social preview image
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # <html>, fonts, <Header/>, global styles
│   │   ├── globals.css                    # `@import "tailwindcss";` + theme tokens
│   │   ├── page.tsx                       # Home: today's Brock (signed in) or landing + sign-in
│   │   ├── leaderboard/
│   │   │   └── page.tsx                   # Global leaderboard (top 100 + your rank)
│   │   ├── onboarding/
│   │   │   ├── page.tsx                   # Choose your handle (first sign-in only)
│   │   │   └── actions.ts                 # Server action: claimHandle()
│   │   ├── u/
│   │   │   └── [handle]/
│   │   │       └── page.tsx               # Public profile: streaks, W/L, last 30 days
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...all]/
│   │       │       └── route.ts           # Better Auth handler (toNextJsHandler)
│   │       ├── brock/
│   │       │   ├── today/
│   │       │   │   └── route.ts           # GET: today's state + open round commit hash
│   │       │   └── throw/
│   │       │       └── route.ts           # POST: submit throw, get result + reveal
│   │       └── leaderboard/
│   │           └── route.ts               # GET: leaderboard JSON (?limit=)
│   ├── components/
│   │   ├── Header.tsx                     # Logo, nav (Play / Leaderboard), user menu
│   │   ├── SignInButtons.tsx              # "use client" — Google / GitHub buttons
│   │   ├── BrockGame.tsx                  # "use client" — orchestrates the play flow
│   │   ├── ThrowPicker.tsx                # "use client" — three big 🪨 📄 ✂️ buttons
│   │   ├── RoundReveal.tsx                # Shows both throws + result + "verify" details
│   │   ├── StreakBadge.tsx                # 🔥 N, current / best
│   │   ├── Countdown.tsx                  # "use client" — time until next UTC midnight
│   │   ├── ShareButton.tsx                # "use client" — copies/shares result text
│   │   ├── LeaderboardTable.tsx           # Rank, handle, streak, best; highlights you
│   │   └── HandleForm.tsx                 # "use client" — onboarding form
│   ├── db/
│   │   ├── index.ts                       # postgres.js client + drizzle instance (singleton)
│   │   └── schema.ts                      # All tables (auth + game), enums, indexes
│   └── lib/
│       ├── auth.ts                        # Better Auth server config (providers, adapter)
│       ├── auth-client.ts                 # Better Auth React client (signIn/signOut)
│       ├── session.ts                     # requireUser() / requirePlayer() helpers
│       ├── game.ts                        # PURE: Throw type, resolveRound(a, b)
│       ├── day.ts                         # PURE: utcDay(now), previousDay(), brockNumber(), msUntilReset()
│       ├── streak.ts                      # PURE: applyWin/applyLoss, effectiveStreak()
│       ├── fairness.ts                    # houseThrow(), newSalt(), commit(), verify()
│       ├── brock-service.ts               # DB: getToday(), submitThrow() — all transactions
│       ├── leaderboard.ts                 # DB: topPlayers(), rankOf()
│       ├── players.ts                     # DB: getPlayerByUserId(), claimHandle(), profile()
│       ├── validation.ts                  # Zod: ThrowBody, HandleInput
│       ├── share.ts                       # PURE: buildShareText()
│       └── errors.ts                      # Typed domain errors → HTTP status mapping
├── tests/
│   ├── unit/
│   │   ├── game.test.ts
│   │   ├── day.test.ts
│   │   ├── streak.test.ts
│   │   ├── fairness.test.ts
│   │   └── share.test.ts
│   ├── integration/
│   │   ├── setup.ts                       # Migrate + truncate test DB between tests
│   │   ├── brock-service.test.ts
│   │   └── leaderboard.test.ts
│   └── e2e/
│       └── brock.spec.ts                  # Sign in (test auth), play until decided, see leaderboard
├── .env.example                           # Every env var, documented, no secrets
├── .gitignore
├── .nvmrc                                 # 24
├── .prettierrc
├── docker-compose.yml                     # postgres:16 for dev (5432) and test (5433)
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml                         # GENERATED by pnpm install
├── postcss.config.mjs
├── README.md                              # Setup, scripts, deploy, rules summary
├── tsconfig.json                          # strict, path alias "@/*" → "src/*"
└── vitest.config.ts                       # two projects: unit, integration
```

That's 62 hand-written files plus generated output (`drizzle/`, `pnpm-lock.yaml`, `next-env.d.ts`).

---

## 4. Data model (`src/db/schema.ts`)

### 4.1 Auth tables (shape set by Better Auth)
Generate them with `npx @better-auth/cli generate` and paste the output into `schema.ts`:
`user`, `session`, `account`, `verification`. Game data stays out of these tables.

### 4.2 Game tables

**`player`**: one row per user, created at onboarding.
| column | type | notes |
|---|---|---|
| `user_id` | text PK, FK → `user.id` ON DELETE CASCADE | |
| `handle` | varchar(20) UNIQUE NOT NULL | regex `^[a-zA-Z0-9_]{3,20}$`, unique case-insensitively (index on `lower(handle)`) |
| `current_streak` | int NOT NULL DEFAULT 0 | stored value. Read it through `effectiveStreak()` |
| `best_streak` | int NOT NULL DEFAULT 0 | |
| `last_win_day` | date NULL | UTC day of the most recent win |
| `total_wins` | int NOT NULL DEFAULT 0 | |
| `total_losses` | int NOT NULL DEFAULT 0 | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Index: `(last_win_day, current_streak DESC)` for the leaderboard query.

**`brock`**: one per player per day.
| column | type | notes |
|---|---|---|
| `id` | uuid PK DEFAULT gen_random_uuid() | |
| `user_id` | text FK → `player.user_id` | |
| `day` | date NOT NULL | UTC day |
| `status` | enum `brock_status` (`pending`, `won`, `lost`) | |
| `created_at` | timestamptz | |
| `decided_at` | timestamptz NULL | |

**`UNIQUE (user_id, day)`**: the database itself enforces one Brock per day.

**`brock_round`**: each throw within a day's Brock. There's more than one only when rounds are drawn.
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `brock_id` | uuid FK → `brock.id` ON DELETE CASCADE | |
| `round_no` | int NOT NULL | starts at 1 |
| `house_throw` | enum `throw` (`rock`, `paper`, `scissors`) | **never sent to the client until revealed** |
| `salt` | text NOT NULL | 16 random bytes, hex |
| `commit_hash` | text NOT NULL | `sha256(house_throw + ":" + salt)` hex |
| `player_throw` | enum `throw` NULL | null means the round is still open |
| `result` | enum `round_result` (`win`, `loss`, `draw`) NULL | from the player's perspective |
| `created_at`, `revealed_at` | timestamptz | |

`UNIQUE (brock_id, round_no)`.

---

## 5. Core logic (pure functions; write these first and test them hardest)

**`game.ts`**
- `type Throw = 'rock' | 'paper' | 'scissors'`
- `resolveRound(player, house): 'win' | 'loss' | 'draw'`: rock beats scissors, scissors beats paper, paper beats rock.

**`day.ts`** (every function takes `now: Date` so tests control the clock)
- `utcDay(now) → 'YYYY-MM-DD'`
- `previousDay(day) → 'YYYY-MM-DD'`
- `brockNumber(day) → int`: days since `LAUNCH_DAY` (env var) + 1
- `msUntilReset(now) → number`: milliseconds until the next 00:00 UTC

**`streak.ts`**
- `applyWin(player, today)`: if `last_win_day === previousDay(today)` then `current + 1`, otherwise `1`. Then `best = max(best, current)`, `last_win_day = today`.
- `applyLoss(player)`: `current = 0`.
- `effectiveStreak(player, today)`: returns `current_streak` if `last_win_day` is `today` or `previousDay(today)`, otherwise `0`. This is how rule R6 works without a cron job. A streak lapses by not being shown, and the stored value is overwritten on the next win or loss.

**`fairness.ts`**
- `houseThrow()`: `['rock','paper','scissors'][crypto.randomInt(3)]`. Never use `Math.random`.
- `newSalt()`: `crypto.randomBytes(16).toString('hex')`
- `commit(throw, salt)`: `sha256(\`${throw}:${salt}\`)` as hex
- `verify(hash, throw, salt)`: boolean. Also used by the client-side "verify" panel through `crypto.subtle.digest`.

**`share.ts`**
- `buildShareText({ brockNumber, rounds, status, streak })`, for example:
  ```
  Brock #42 🔥7
  🪨🪨 → 📄✂️ ✅
  brock.example.com
  ```

---

## 6. API contract

All game endpoints require a signed-in user with a `player` row. They return `401` without a session and `403 {error:"onboarding_required"}` without a handle.

### `GET /api/brock/today`
Idempotent. Inside one transaction:
1. `INSERT … ON CONFLICT (user_id, day) DO NOTHING` the `brock` row for today, then `SELECT … FOR UPDATE` it.
2. If `status = 'pending'` and there's no open round, create round N+1 with `houseThrow()`, `newSalt()` and `commit()`.
3. Return:
```json
{
  "day": "2026-10-14", "brockNumber": 42, "status": "pending",
  "streak": { "current": 6, "best": 9 },
  "rounds": [ { "roundNo": 1, "player": "rock", "house": "rock", "salt": "…", "commitHash": "…", "result": "draw" } ],
  "openRound": { "roundNo": 2, "commitHash": "ab12…" },
  "msUntilReset": 31234000
}
```
Only revealed rounds include `house` and `salt`. `openRound` is `null` once the Brock is decided.

### `POST /api/brock/throw`
Body (Zod `ThrowBody`): `{ "roundNo": 2, "throw": "paper" }`. Inside one transaction:
1. `SELECT` today's `brock` `FOR UPDATE`. If it's missing, return `409 new_day`. If it's not pending, return `409 already_played`.
2. Load the open round. If `roundNo` doesn't match, return `409 stale_round`. This blocks double submits and replays.
3. Set `player_throw`, `result = resolveRound(...)`, `revealed_at = now()`.
4. On a **draw**, create the next round (new throw, salt and commit) and keep `status = pending`.
5. On a **win**, set `status = won` and `UPDATE player` with `applyWin` and `total_wins + 1`.
6. On a **loss**, set `status = lost` and `UPDATE player` with `applyLoss` and `total_losses + 1`.
7. Return the revealed round (`house`, `salt`, `commitHash`, `result`), the new `status`, `streak`, and `openRound` if it was a draw.

The row lock and the unique constraint mean that two tabs submitting at once can't both win, and nobody can play twice in a day.

### `GET /api/leaderboard?limit=100`
Public, no auth needed. `limit` is clamped to 1–100.
```sql
SELECT handle, current_streak, best_streak,
       RANK() OVER (ORDER BY current_streak DESC, best_streak DESC) AS rank
FROM player
WHERE current_streak > 0 AND last_win_day >= :yesterday
ORDER BY current_streak DESC, best_streak DESC, lower(handle) ASC
LIMIT :limit;
```
When signed in, the response also includes `me: { rank, streak }`. `rank` is 1 + the number of players with a strictly better (streak, best). Responses are sent with `Cache-Control: s-maxage=30, stale-while-revalidate=60`.

### Errors
`src/lib/errors.ts` defines `DomainError` with a `code` field. Route handlers turn these into `{ error: code }` with the matching status: 400 for validation, 401, 403, 409. Unexpected errors return 500 without exposing internals.

---

## 7. Pages and UX

| Route | Signed out | Signed in, no handle | Signed in |
|---|---|---|---|
| `/` | Landing page: what Brock is, top 5 leaderboard, sign-in buttons | redirect → `/onboarding` | `<BrockGame/>` |
| `/onboarding` | redirect → `/` | `<HandleForm/>` | redirect → `/` |
| `/leaderboard` | Leaderboard | Leaderboard | Leaderboard with your row highlighted and your rank shown if you're outside the top 100 |
| `/u/[handle]` | Profile | Profile | Profile |

**`BrockGame` states**
1. **Loading**: calls `GET /api/brock/today`.
2. **Ready**: shows "Brock #42" and the streak badge, then "The House has chosen. 🔒 `ab12…`" above the `ThrowPicker`.
3. **Submitting**: picker disabled, then a short 1-2-3 shake animation (~1.2s, CSS only, skipped with `prefers-reduced-motion`).
4. **Draw**: `RoundReveal` shows both throws and "Draw, go again!", then returns to Ready with the new commit hash.
5. **Won / Lost**: final `RoundReveal`, updated streak, `ShareButton`, `Countdown` to the next Brock, and a link to the leaderboard.
6. **Already played** (on return visits): goes straight to state 5 using the saved rounds.

`RoundReveal` has a "Verify fairness" toggle. It shows the hash, throw and salt, and recomputes SHA-256 in the browser with `crypto.subtle` to show ✅.

Accessibility: the three throw buttons get `aria-label`s, results are announced through an `aria-live="polite"` region, and everything is keyboard-operable. Layout is mobile-first because most of your group will play on their phones.

---

## 8. Environment variables (`.env.example`)

```
# Database
DATABASE_URL=postgres://brock:brock@localhost:5432/brock
TEST_DATABASE_URL=postgres://brock:brock@localhost:5433/brock_test

# Better Auth
BETTER_AUTH_SECRET=            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# OAuth providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Game
LAUNCH_DAY=2026-11-01          # Brock #1
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Testing only, NEVER set in production: enables email/password sign-in for Playwright
E2E_TEST_AUTH=false
```

---

## 9. `package.json` scripts

| Script | Command |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `format` | `prettier --write .` |
| `typecheck` | `tsc --noEmit` |
| `db:up` | `docker compose up -d` |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:studio` | `drizzle-kit studio` |
| `test` | `vitest run --project unit` |
| `test:integration` | `vitest run --project integration` |
| `test:e2e` | `playwright test` |

---

## 10. Build order

Finish each phase, meet its acceptance criteria and commit before starting the next.

### Phase 0: Scaffold (≈1 hr)
1. `pnpm create next-app@latest brock --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` (or scaffold in place in this repo).
2. Add `.nvmrc`, `.prettierrc`, `.env.example` and `docker-compose.yml`, and set `strict` in `tsconfig.json`.
3. Install the dependencies: `drizzle-orm postgres better-auth zod`, and as dev dependencies `drizzle-kit vitest @playwright/test prettier`.
4. Add the scripts from §9.

✅ `pnpm dev` serves the default page, and `pnpm lint`, `pnpm typecheck` and `pnpm db:up` all succeed.

### Phase 1: Pure game logic + unit tests (≈2 hrs)
Files: `lib/game.ts`, `lib/day.ts`, `lib/streak.ts`, `lib/fairness.ts`, `lib/share.ts`, `vitest.config.ts` and `tests/unit/*`.
Tests must cover:
- all 9 throw combinations
- UTC day boundaries at 23:59:59.999Z and 00:00:00.000Z
- `previousDay` across a month, a year and Feb 29
- a win after yesterday's win, a win after a gap, a loss, and `effectiveStreak` after a missed day
- `verify(commit(t, s), t, s)` is true and a tampered value is false
- `houseThrow` distribution over 30k samples is within ±2% of ⅓ for each throw

✅ `pnpm test` is green and the `lib/` coverage on these files is ≥ 95%.

### Phase 2: Database (≈1.5 hrs)
Files: `db/schema.ts`, `db/index.ts` and `drizzle.config.ts`, then `pnpm db:generate` → `drizzle/0000_initial.sql`.

✅ `pnpm db:migrate` succeeds on a fresh database, `db:studio` shows all 7 tables, and inserting a second `brock` for the same (user, day) fails.

### Phase 3: Auth + onboarding (≈2 hrs)
1. Create OAuth apps:
   - **GitHub**: Settings → Developer settings → OAuth Apps, callback `http://localhost:3000/api/auth/callback/github`
   - **Google**: Cloud Console → Credentials → OAuth client (Web), with the same callback pattern ending in `/google`
2. Files: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `lib/session.ts`, `components/SignInButtons.tsx`, `components/Header.tsx`, `app/onboarding/*`, `components/HandleForm.tsx`, `lib/players.ts` and `lib/validation.ts`.
3. `claimHandle` validates with Zod and inserts the `player` row. A unique violation returns "Handle taken".

✅ You can sign in with both providers, a new user is sent to `/onboarding`, the handle is saved, and you return to `/`. Signing out works.

### Phase 4: The Brock (≈4 hrs). This is the core.
Files: `lib/errors.ts`, `lib/brock-service.ts`, `app/api/brock/today/route.ts`, `app/api/brock/throw/route.ts`, `tests/integration/setup.ts` and `tests/integration/brock-service.test.ts`.
Integration tests run against a real Postgres on port 5433. They must cover:
- `getToday` is idempotent and calling it twice creates one round
- a draw creates round 2 and keeps the Brock pending
- a win increments the streak and a consecutive-day win increments it again
- a loss resets the streak
- a second throw after a decision returns 409 `already_played`
- the wrong `roundNo` returns 409 `stale_round`
- **concurrency**: 10 parallel `submitThrow` calls on one open round give exactly one success
- `house_throw` never appears in any response before it's revealed

✅ `pnpm test:integration` is green. You can play through the API with curl and a session cookie.

### Phase 5: Game UI (≈4 hrs)
Files: `app/page.tsx`, `components/BrockGame.tsx`, `ThrowPicker.tsx`, `RoundReveal.tsx`, `StreakBadge.tsx`, `Countdown.tsx`, `ShareButton.tsx` and `app/globals.css`.

✅ A full play-through works on a phone-sized viewport (375px). Refreshing after playing shows the result rather than the picker. Verify-fairness shows ✅. Share copies the text.

### Phase 6: Leaderboard + profiles (≈2.5 hrs)
Files: `lib/leaderboard.ts`, `app/api/leaderboard/route.ts`, `app/leaderboard/page.tsx`, `components/LeaderboardTable.tsx`, `app/u/[handle]/page.tsx` and `tests/integration/leaderboard.test.ts`.
Tests: ordering, tied ranks, lapsed streaks (last win 2+ days ago) left out, the `limit` clamp, and `rankOf` for a player outside the top 100.

✅ With 3 seeded players the order is correct, your row is highlighted, and a profile shows the last 30 days as a ✅/❌/· strip.

### Phase 7: E2E + CI (≈2 hrs)
1. In `lib/auth.ts`, turn on `emailAndPassword` **only** when `E2E_TEST_AUTH === 'true'`.
2. `playwright.config.ts` starts `pnpm build && pnpm start` with the test database.
3. `tests/e2e/brock.spec.ts`: sign up → onboard → throw until decided → check the result and streak → open `/leaderboard`.
4. `.github/workflows/ci.yml` jobs:
   - `lint`, `typecheck` and `test`
   - `integration`, with a `services: postgres:16` container, then `db:migrate`
   - `e2e`, which installs Playwright browsers and uploads the report on failure

✅ CI is green on a PR.

### Phase 8: Deploy (≈1 hr)
1. Create a Neon project and copy the **pooled** connection string into `DATABASE_URL`.
2. Import the repo into Vercel and set every env var from §8 except `TEST_*` and `E2E_*`. Set `BETTER_AUTH_URL` to the production URL.
3. Add the production callback URLs to both OAuth apps.
4. Run migrations against Neon (`DATABASE_URL=… pnpm db:migrate` locally, or as a CI deploy step).
5. Set `LAUNCH_DAY` and add `og.png` and the favicon.

✅ The production URL works end to end and the first friend gets Brock #1.

**Total: about 20 hours for one developer.**

---

## 11. Security and abuse checklist

- [ ] The House's throw is created and stored only on the server and leaves it only after the player's throw is saved (tested in Phase 4)
- [ ] `crypto.randomInt`, never `Math.random`
- [ ] Every game write happens in a transaction holding a row lock, backed by `UNIQUE (user_id, day)`
- [ ] The server sets the day from its own clock and ignores any day or time the client sends
- [ ] Zod validation on every request body and handle input. Handles are restricted to `[a-zA-Z0-9_]`, which makes stored XSS through handles impossible.
- [ ] Better Auth rate limiting is on. Session cookies are `httpOnly`, `secure` and `sameSite=lax`.
- [ ] `E2E_TEST_AUTH` is never set in production, and a startup assert throws if `NODE_ENV=production && E2E_TEST_AUTH=true`
- [ ] Known limitation: one person could make several accounts across OAuth providers to farm streaks. That's acceptable for a friends game. Fixing it later could mean single-provider sign-in or an admin "ban handle" tool.

---

## 12. After v1 (out of scope, but the design leaves room)

- **Friend leagues**: a `league` and `league_member` table plus an invite code, giving each group of friends its own leaderboard. This is probably the first thing your group will ask for.
- **Async PvP mode**: two players commit throws for the day and the result is revealed when both have played. It reuses the commit–reveal and `brock_round` model.
- **Streak freeze**: earn one freeze every 7 wins, which lets you skip a day under R6.
- **Push reminders**: Web Push "You haven't Brocked today" at 18:00 local time.
- **Discord sign-in**: one more Better Auth provider.
- **Stats**: your throw tendencies, and the House's all-time distribution as public proof that it plays fair.
