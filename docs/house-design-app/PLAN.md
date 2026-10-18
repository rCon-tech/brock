# Hearth — Build Plan

> **Revision 2 (replaces Revision 1 entirely).** Pinterest is gone, along with the property-wide scope, floorplans, room photos and mock-ups. The MVP now does one job: **get two (or more) people to agree on a room's style in under 5 minutes.** Everyone swipes the *same* curated deck, and a synthesis engine turns the swipes into exact matches, a named "bridge" style, compromise pieces and buy links. Floorplans and mock-ups move to v2 (§15).

**Hearth** (working name) is a mobile-first web app. Partner A starts a room project ("Living Room") and sends a link or QR code. Partner B opens it and starts swiping straight away, with no app to download and no account to create. Each person swipes about 12 whole-room photos (the vibe check) and then about 18 individual products (sofas, rugs, lighting…), and can spend up to 3 vetoes on hard deal-breakers. When everyone has finished, both see one shared board:

- **Agreed:** pieces everyone swiped right on, with buy buttons
- **Your bridge style:** a named hybrid such as *"Warm Industrial"*, with the reasoning and what each person brings to it
- **Compromise picks:** catalogue pieces that score well for *both* people, even if neither swiped them
- **You both love / you differ on:** shared and clashing elements (dark wood, brass, clean lines…)
- **Vetoes:** each person's deal-breakers, which are excluded from every suggestion

An optional 8-card **tie-breaker round** lets both people swipe the compromise picks, which turns "suggested" into "agreed".

This document covers everything needed to build the MVP: the product rules, every technology, the external accounts, the catalogue pipeline, the algorithms, every file, the build order, the metrics and the risks. No code exists yet. Each phase ends with acceptance criteria.

> This plan sits in the `brock` repo only because that's where it was written. Hearth is a separate app: start a new repo (e.g. `rcon-tech/hearth`) and copy this file in as its `PLAN.md`. It reuses the Brock stack (Next.js 16, Drizzle, Postgres, Vitest, Playwright, Vercel + Neon), and Brock's "no account until you need one" approach.

---

## 1. Product thesis (what we're testing)

- Inspiration tools (Pinterest, Instagram) produce endless boards but no decisions. Planning tools (Homestyler, Planner 5D) need spatial setup before you get to style. Style quizzes (e.g. Havenly's Style Shuffle) are single-user.
- Nobody **reconciles two people's tastes**. When A leans Industrial and B leans Minimalist, today's tools show zero overlap. Hearth finds the shared elements and proposes a bridge.
- Making the second person sign up kills the loop, so **partner B never needs an account**.

The MVP succeeds if (measured in PostHog, §11):

| Metric | Target |
|---|---|
| Invited partners who finish swiping | ≥ 60% |
| Median time from partner B opening the link to the board being ready | ≤ 5 min |
| Boards rated "this helped us agree" (thumbs on the board) | ≥ 60% 👍 |
| Boards with ≥ 1 buy-button click | ≥ 25% |

---

## 2. Product rules (decide these first)

| # | Rule | Default | Why |
|---|---|---|---|
| R1 | Project | **One room** (room type + optional name + optional budget band). A user can have many. | Matches "resolve this room" |
| R2 | Who starts | Creator signs in with **Google** (so they can come back and get the "they've finished" email). | The person who cares most has a reason to sign in |
| R3 | Who joins | Anyone with the link/QR, as a **guest**: they type a first name and swipe. Guests can "Save with Google" later and keep their swipes. | No sign-up before value |
| R4 | Participants | 2 by default, up to **4** (e.g. a teenager's bedroom, a house share). All the maths is N-person. | Couples first, without hard-coding 2 |
| R5 | Invite link | Unguessable token, valid 14 days, until the project has 4 participants; the creator can revoke and regenerate. Also shown as a QR code. | Easy to share in person or over chat |
| R6 | Room types at launch | **Living room, bedroom, dining room** | Furniture-led rooms swipe well. Kitchens and bathrooms are mostly fixtures; add them later. |
| R7 | Decks | **Macro**: 12 whole-room photos. **Micro**: 18 products across fixed category quotas (§7.2). Everyone in a project gets the **same cards**, in their own shuffled order. | The same cards make exact matches possible; shuffling avoids order bias |
| R8 | Swipe | Right = yes, left = no. Undo the last swipe. No "maybe": forced choice gives a cleaner signal and is faster. | Speed |
| R9 | Vetoes | **3 per person per project**. A veto is a hard "no" on a card, and you can optionally say *why* by tapping one of its tags ("it's the velvet"). A vetoed item is never suggested; a vetoed **attribute** removes every item carrying it from compromise picks. | The deal-breaker layer from the brief, made more useful than a single card |
| R10 | Privacy until reveal | You can't see anyone else's swipes until **you** have finished. The board appears once everyone who joined has finished, or when the creator presses "Show results now" (needs ≥ 2 finished). | Prevents anchoring on the partner's choices |
| R11 | Tie-breaker round | After the board appears, an optional 8-card round of compromise picks. Mutual yes → moves into **Agreed**. Can be repeated twice. | Turns suggestions into agreement |
| R12 | Buying | Product cards link through `/go/[itemId]`, which logs the click and redirects to the **affiliate link**. Affiliate disclosure on every board and in the footer. | Revenue + UK ASA/CMA (and US FTC) disclosure rules |
| R13 | Budget band | Optional at project creation: £ / ££ / £££ (thresholds per category in config). Filters micro deck and compromise picks. | Stops "you both love a £6k sofa" |

---

## 3. Technology (every piece)

### 3.1 App

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Language | TypeScript | 5.9 | Everything |
| Runtime | Node.js | 24 (`.nvmrc`), engines `>=22` | Server, scripts |
| Package manager | pnpm | 10 | — |
| Framework | Next.js (App Router) | 16 | Pages, Server Actions, route handlers, `after()` for post-response work, `proxy.ts` |
| UI | React | 19 | — |
| Styling | Tailwind CSS | 4 | — |
| Components | shadcn/ui (Radix primitives, copied into `src/components/ui`) | latest CLI | Buttons, dialogs, sheets, toasts, tabs, avatars |
| Icons | lucide-react | latest | — |
| Swipe physics | **motion** (formerly Framer Motion) + **@use-gesture/react** | 12 / 10 | Drag, fling, spring-back, card stack animation |
| Client data | TanStack Query | 5 | Polling project state, optimistic swipes |
| Validation | Zod | 4 | Inputs, env, AI output, feed rows |
| QR codes | `qrcode` | 1.5 | Server-rendered SVG QR for the invite link |

### 3.2 Data, auth, email, analytics

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Database | PostgreSQL + **pgvector** | Postgres 16, pgvector 0.8 | All data + catalogue embeddings, style centroids |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45 / 0.31 | Schema, `vector()` columns, `cosineDistance()` |
| Driver | postgres.js | 3 | — |
| Auth | **Better Auth**: Google social provider + **anonymous plugin** + Drizzle adapter | 1.x | Google sign-in for creators; guest sessions for partners, linkable to Google later without losing data |
| Email | **Resend** (+ React Email templates) | latest | One email: "Sam has finished — your board is ready" to the creator |
| Product analytics | **PostHog** (`posthog-js`, `posthog-node`), cookieless mode until consent | latest | Funnels for the §1 metrics |
| Errors | Sentry (`@sentry/nextjs`) | latest | — |
| Scheduled jobs | **Vercel Cron** → route handler | — | Nightly product-feed refresh (price/stock) |

No job queue is needed: deck building and synthesis are fast in-process maths over pre-computed embeddings. The only live AI call (naming the bridge style) runs in `after()` once the response has been sent, and the board polls until it's there.

### 3.3 Catalogue sources and AI (mostly offline)

| Job | Service | Detail | When |
|---|---|---|---|
| Whole-room photos (macro) | **Unsplash API** (Pexels API as a second source) | Free; licence allows use and modification; API terms require hotlinking their URLs, attribution ("Photo by X on Unsplash") and pinging the `download_location` when a photo is used | Import script; production-access approval from Unsplash before launch |
| Products (micro) | **Awin** product feeds (UK affiliate network; add Rakuten/Impact/CJ for other retailers or regions) | CSV/XML feeds give title, image, price, stock, deep link with affiliate tracking. You must be approved by each retailer's programme on Awin. | Import script + nightly refresh |
| Ad-hoc products | **Skimlinks** (optional) | Turns any retailer URL into an affiliate link, for hand-curated items not in a feed | Admin |
| Tagging every catalogue item | **Claude API** (`@anthropic-ai/sdk`) via **Message Batches** (50% cheaper) | `claude-opus-5-5`, effort `low`, structured output: style weights, materials, colours, finishes, lines/shape, era, category, room types, quality flags | Offline, once per item |
| Image embeddings ("CLIP-like") | **Voyage AI** multimodal embeddings (`voyageai`) | `voyage-multimodal-3` (1024-d; use the newest multimodal model when you start). Image + short text in one vector. | Offline, once per item |
| Naming the bridge style + rationale | Claude API | `claude-opus-5-5`, effort `low`, structured output, server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) | Live, once per board (version) |

> **Why Voyage instead of raw CLIP:** the catalogue is embedded offline, so either works. Voyage keeps everything in TypeScript with no GPU or Python, and it embeds text into the same space, which lets the admin tools search the catalogue for "dark wood" or "brass". If you'd rather self-host, an open SigLIP/CLIP model in a one-off Python script producing the same `vector` column is a drop-in swap. Keep the dimension in one constant.

### 3.4 Quality and delivery

| Layer | Choice | Purpose |
|---|---|---|
| Unit + integration | Vitest 3 (`unit`, `integration` projects) | Algorithms, DB |
| HTTP mocking | MSW 2 | Fake Anthropic, Voyage, Unsplash, Resend in tests |
| E2E | Playwright (two browser contexts = two partners) | Full flow |
| Lint / format / types | ESLint 9, Prettier 3, `tsc --noEmit` | — |
| CI | GitHub Actions (Postgres + pgvector service container) | — |
| Scripts runner | `tsx` | Catalogue import/tag/embed scripts |
| Feed parsing | `csv-parse` | Awin CSV feeds |
| Local DB | Docker Compose, `pgvector/pgvector:pg16` | Dev :5432, test :5433 |
| Hosting | Vercel (app + Cron) + Neon Postgres (`CREATE EXTENSION vector`) | — |

---

## 4. Accounts and keys (Day 0)

Start the approvals first: Unsplash and the affiliate programmes have lead time.

1. **Google Cloud** → Google Auth Platform → consent screen (External) → Web OAuth client. Redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://<domain>/api/auth/callback/google`. Scopes `openid email profile` (no verification review needed).
2. **Unsplash** → unsplash.com/developers → new app (starts in demo mode with a low hourly limit) → apply for **production** once the swipe screen shows attribution correctly (they review screenshots).
3. **Awin** → sign up as a **publisher** → add your site and promotional method → apply to the programmes of the homeware retailers you want → once approved, create a product-feed download URL. Approval for each programme is manual and some retailers want an existing live site: launch the site with a landing page early.
4. **Anthropic** console → API key, monthly spend limit.
5. **Voyage AI** → API key.
6. **Resend** → API key, verify your sending domain (DNS records).
7. **PostHog** → project (EU cloud if you're UK/EU-based) → project API key.
8. **Neon** → database `hearth` → `CREATE EXTENSION IF NOT EXISTS vector;`.
9. **Vercel** → import repo, set env vars, add the cron (§9.1 `vercel.ts`).
10. **Sentry** → Next.js project → DSN.
11. Secrets: `openssl rand -base64 32` for `BETTER_AUTH_SECRET` and `CRON_SECRET`.

### Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | App DB, test DB (wiped by tests) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `ANTHROPIC_API_KEY` | Tagging + bridge naming |
| `VOYAGE_API_KEY` | Embeddings (scripts only) |
| `UNSPLASH_ACCESS_KEY` | Photo import + download pings |
| `AWIN_FEED_URLS` | Comma-separated feed download URLs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Notification email |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics |
| `SENTRY_DSN` | Errors |
| `CRON_SECRET` | Vercel Cron calls the refresh route with `Authorization: Bearer <CRON_SECRET>` |
| `ADMIN_EMAILS` | Comma-separated Google emails allowed into `/admin` |
| `E2E_TEST_AUTH` | `1` only in E2E: enables `/api/test/sign-in` (route refuses in production) |

---

## 5. Architecture

```
            ┌──────────── OFFLINE (scripts, run by you) ─────────────┐
 Unsplash ─►│ import-photos ─┐                                        │
 Awin    ──►│ import-feed  ──┼─► catalogue_item (draft)               │
            │                ├─► tag-catalogue   (Claude Batches)     │
            │                ├─► embed-catalogue (Voyage)             │
            │                └─► build-style-centroids                │
            │ /admin/catalogue: review → status = live                │
            └─────────────────────────────────────────────────────────┘
                                   │ Postgres + pgvector
            ┌──────────── ONLINE (Next.js on Vercel) ─────────────────┐
 Partner A ─► create project ─► deck builder (pure TS) ─► project.decks
            ─► share link / QR
 Partner B ─► /j/[token] ─► guest session ─► swipe macro → micro (+ vetoes)
 last finisher ─► synthesis (pure TS, ms) ─► after(): Claude names bridge
            ─► board ─► tie-breaker round ─► /go/[id] affiliate redirect
 Vercel Cron (nightly) ─► refresh feeds: price, stock, retire dead items
```

Rules of the road:

- **All per-user maths is deterministic TypeScript** in `src/lib/engine/`, unit-tested with synthetic vectors. AI is used only (a) offline to understand the catalogue and (b) once per board to *name and explain* a result the maths already chose. So the AI can't invent a match, and a failed AI call only costs the nice wording (the board falls back to the taxonomy name).
- **Every project-scoped action calls `requireParticipant(projectId)`.** Guests are real (anonymous) Better Auth users, so there's one permission path.
- Swipes are written one by one (idempotent upsert on `(participant_id, item_id)`) so closing the tab mid-deck loses nothing.

---

## 6. Data model

Ids are app-generated `text` except Better Auth's tables. All tables have `created_at`.

### 6.1 Auth (generated by the Better Auth CLI)

`user` (…, `is_anonymous`), `session`, `account`, `verification`.

### 6.2 Catalogue

| Table | Columns | Notes |
|---|---|---|
| `catalogue_item` | id, tier `macro|micro`, room_types text[], category (micro only, §7.1), title, image_url, image_w, image_h, source `unsplash|pexels|awin|manual`, source_id, attribution_name, attribution_url, unsplash_download_location, retailer, price_pence, currency, product_url, affiliate_url, in_stock bool, status `draft|live|retired`, tags jsonb (§7.1 shape), primary_style, style_weights jsonb (`{style: 0..1}`), embedding `vector(1024)`, tagged_at, embedded_at, last_seen_in_feed_at | Unique (source, source_id). HNSW index on embedding (cosine). GIN on room_types. |
| `style` | slug (PK), name, description, centroid `vector(1024)`, item_count | ~25 rows, rebuilt by script |

### 6.3 Projects and people

| Table | Columns | Notes |
|---|---|---|
| `project` | id, room_type, name, budget_band (nullable), created_by → user, macro_deck text[], micro_deck text[], deck_seed, reveal_forced_at (nullable) | Decks frozen at creation (R7) |
| `project_invite` | id, project_id, token_hash, expires_at, revoked_at | Raw token only in the link |
| `participant` | id, project_id, user_id, display_name, role `creator|partner`, joined_at, macro_done_at, micro_done_at, vetoes_left (default 3) | Unique (project_id, user_id); max 4 per project (checked in a transaction) |
| `swipe` | participant_id, item_id, round `macro|micro|bridge`, value smallint (−1/1), decision_ms int, position int, created_at, updated_at | PK (participant_id, item_id, round) |
| `veto` | id, participant_id, item_id, attribute (nullable, e.g. `material:velvet`) | Counts against `vetoes_left` |
| `synthesis` | project_id, version, inputs_hash, status `computing|ready`, result jsonb (§7.4 shape), bridge_name, tagline, rationale, contributions jsonb, ai_model, computed_at | Latest version is shown; recomputed when swipes/vetoes change after reveal (e.g. tie-breaker) |
| `bridge_round` | id, project_id, synthesis_version, item_ids text[], created_at | Max 2 per project |
| `board_feedback` | project_id, participant_id, helpful bool | The "this helped us agree" thumbs |
| `outbound_click` | id, item_id, project_id, participant_id (nullable), created_at | Affiliate clicks |

---

## 7. Catalogue pipeline (offline)

### 7.1 Taxonomy (`src/lib/taxonomy.ts`)

- **Room types:** living_room, bedroom, dining_room (kitchen, bathroom, office, kids_room reserved for later).
- **Styles (~25):** industrial, minimalist, japandi, scandinavian, mid_century, modern_farmhouse, coastal, boho, traditional, art_deco, maximalist, rustic, contemporary, mediterranean, wabi_sabi, hollywood_regency, french_country, transitional, organic_modern, eclectic, cottagecore, warm_minimal, brutalist, shaker, retro_70s.
- **Attribute families** (the "elements" both people can share):
  - `material`: oak, walnut, dark_wood, light_wood, rattan, cane, marble, travertine, concrete, linen, boucle, velvet, leather, wool, jute, metal_black, brass, chrome, glass, ceramic
  - `colour`: white, cream, beige, greige, grey, charcoal, black, sage, olive, terracotta, rust, navy, blush, mustard, multicolour
  - `line`: clean_lines, curved, chunky, slim_legs, tufted, rounded_edges, geometric, ornate
  - `finish`: matte, gloss, distressed, natural, lacquered
  - `mood`: airy, cosy, dramatic, calm, playful, earthy
- **Micro categories** (living room quota in brackets): sofa (3), armchair (2), coffee_table (2), rug (3), ceiling_light (1), floor_lamp (1), table_lamp (1), storage (2), side_table (1), decor (2). Bedroom and dining have their own quotas in `src/lib/engine/quotas.ts`.

### 7.2 Scripts (run locally against prod DB, or as a protected admin action)

| Script | Does |
|---|---|
| `scripts/import-photos.ts --room living_room --query "living room interior" --pages 10` | Unsplash search → upsert `catalogue_item` (tier macro, status draft), store attribution + download_location. Skips images < 1600px or portrait-only-wrong-aspect (keep 4:5–3:4 portrait, best on phones). |
| `scripts/import-feed.ts` | Downloads each `AWIN_FEED_URLS` feed, maps rows with Zod (title, image, price, stock, deep link, merchant category) → candidate micro items (draft). Category mapping from merchant categories via `src/lib/catalogue/category-map.ts`; unmapped rows skipped and counted. |
| `scripts/tag-catalogue.ts` | All items with `tagged_at IS NULL` → one Claude Batches request per item (image by URL + title) → validate against `ItemTagsSchema` → write tags, primary_style, style_weights. Rejects (status retired) items flagged `not_a_room`, `watermark`, `cluttered`, `cut_out_poor`. |
| `scripts/embed-catalogue.ts` | Items with `embedded_at IS NULL` → Voyage multimodal (image + "{title}. {primary_style}. {top tags}") in chunks → write embedding. |
| `scripts/build-style-centroids.ts` | For each style: weighted mean of live items' embeddings (weight = style_weights[style], only ≥ 0.5) → normalise → `style.centroid`. Prints item counts; a style with < 15 items gets a warning. |
| `scripts/seed-dev.ts` | Loads `tests/fixtures/catalogue.json` (≈ 120 items with synthetic 1024-d vectors) for local dev and E2E, no API keys needed. |

**Launch catalogue target:** per room type ≈ 150 live macro photos and ≈ 400 live micro products, spread across styles (the admin page shows a style × category coverage grid so gaps are visible).

### 7.3 Admin review (`/admin/catalogue`)

Grid of draft items with their tags, filterable by room/tier/style/category. Actions: approve (→ live), retire, edit tags, set room types. Bulk approve. Coverage grid. Text search via Voyage text embedding ("brass floor lamp") — the only online Voyage call, admin only.

### 7.4 Nightly refresh (`/api/cron/refresh-feeds`)

Re-download feeds, update price/stock/affiliate_url by (source, source_id). Items missing from the feed for 3 nights → `retired`. Out-of-stock items stay in history but are excluded from decks and compromise picks; on an existing board they show "Out of stock" without a buy button.

---

## 8. The engine (all pure TypeScript, `src/lib/engine/`)

Notation: `e(i)` is item i's normalised embedding; `P` the set of participants; `L_p`, `D_p` the items p swiped right/left on (macro and micro; macro swipes weight ×1.5 because a whole room says more about overall taste).

### 8.1 Deck building (at project creation)

- **Macro (12 photos):** live macro items for the room type. Pick by **farthest-point sampling** over embeddings, starting from a seeded random item, with a constraint that the 12 cover ≥ 8 distinct `primary_style`s. Diversity is what lets 12 swipes locate someone's taste.
- **Micro (18 products):** for each category quota (§7.1), live in-stock items in budget band, farthest-point sampling within the category so the 3 sofas look different from each other.
- Each participant gets the same cards in their own seeded shuffle (macro always before micro).

### 8.2 Taste profile per person

- **Taste vector:** `t_p = normalise( mean_w(e(L_p)) − 0.5 · mean_w(e(D_p)) )` (weighted means; Rocchio-style).
- **Attribute affinity:** for each attribute a on cards p has seen, `n` = exposures, `k` = right swipes; `aff_p(a) = (k + 1)/(n + 2) − 0.5` (Laplace-smoothed, range −0.5..+0.5). Ignore attributes with `n < 2`.
- **Top styles:** rank styles by `cos(t_p, centroid_s)`; keep the top 3 with scores.
- **Confidence:** fraction of macro swipes that agree with the top style's direction; shown as "strong / mixed taste". Low confidence makes the board suggest the tie-breaker round more prominently.

### 8.3 Synthesis (when the board is revealed, and after each tie-breaker round)

1. **Exact matches ("double rights"):** items every participant swiped right on, minus vetoed items. Micro matches → **Agreed** with buy buttons; macro matches → "Rooms you both loved".
2. **Shared elements:** attributes with `aff_p(a) ≥ 0.2` for every p. Ranked by min affinity. → "You both love: dark wood · clean lines · brass".
3. **Conflicts:** attributes where one person ≥ 0.2 and another ≤ −0.2. → "You differ on: velvet · navy".
4. **Bridge style (maximin):** `bridge = argmax_s  min_p cos(t_p, centroid_s)`. The style the *least happy* person likes most. If every person's own top style is the same style, the board says "You already agree: Japandi" instead.
5. **Compromise picks:** candidate pool = live, in-stock, in-budget micro items for the room type (whole catalogue, not just the deck), excluding vetoed items, items carrying a vetoed attribute, and items anyone swiped left on.
   `s_p(i) = cos(e(i), t_p) + 0.3 · mean_{a ∈ tags(i)} aff_p(a)`; `score(i) = min_p s_p(i)` (maximin again: an item both people are OK with beats one person loves and the other hates).
   Take the top 12 by score with **MMR** diversity (λ = 0.7) and at most 2 per category. Use a pgvector prefilter (top 300 nearest to the mean of the taste vectors) so this stays fast.
6. **Hybrid rooms:** top 4 macro photos by the same maximin score → "Rooms in your bridge style".
7. **Write** `synthesis.result` (all ids + scores + attributes) with `status = computing`, respond, then in `after()`:
8. **Name it (Claude):** input = each person's display name + top styles, the bridge style, shared elements, conflicts, and the compromise picks' tags. Output (`BridgeNameSchema`): `{ name (≤ 3 words, built from taxonomy vocabulary, e.g. "Warm Industrial"), tagline (≤ 12 words), rationale (≤ 60 words), contributions: [{ participant, brings (≤ 15 words) }] }`. Validated; on failure or refusal, fall back to the bridge style's taxonomy name and a template sentence. Set `status = ready`.

All of steps 1–6 take milliseconds. The `inputs_hash` (hash of all swipes + vetoes) skips recomputing when nothing changed.

### 8.4 Tie-breaker round

8 cards: the top 8 compromise picks nobody has swiped yet. Both people swipe them (same flow, round `bridge`). Mutual yes → Agreed. Then re-run synthesis (version + 1). Max 2 rounds per project.

### 8.5 Test fixture that captures the whole idea

`tests/fixtures/industrial-vs-minimalist.json`: a synthetic catalogue where A swipes right only on industrial items and B only on minimalist ones. **No exact matches.** Expected: shared elements include `clean_lines` and `metal_black` (present in both styles' fixture items); the bridge style is `warm_minimal`, whose fixture centroid sits between the two, not either person's own top style; every compromise pick scores ≥ 0.4 for both. This is the demo case in the pitch, so it's a regression test.

---

## 9. Every file

✱ = generated by a tool.

### 9.1 Root

| File | Purpose |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `vercel-build` (migrate on prod, then build), `lint`, `format`, `typecheck`, `db:up`, `db:generate`, `db:migrate`, `db:studio`, `db:seed` (`tsx scripts/seed-dev.ts`), `catalogue:photos`, `catalogue:feed`, `catalogue:tag`, `catalogue:embed`, `catalogue:centroids`, `test`, `test:integration`, `test:e2e` |
| `pnpm-lock.yaml` ✱ | — |
| `.nvmrc` | `24` |
| `.env.example` | §4 vars, empty |
| `.gitignore`, `.prettierrc`, `.prettierignore` | — |
| `eslint.config.mjs` | Next + TS |
| `tsconfig.json` | Strict, `@/*` → `src/*` |
| `next.config.ts` | `images.remotePatterns` for `images.unsplash.com` and feed image hosts; Sentry wrapper |
| `vercel.ts` | Cron: `/api/cron/refresh-feeds` daily at 03:17 UTC |
| `postcss.config.mjs` | Tailwind 4 |
| `components.json` | shadcn/ui |
| `drizzle.config.ts` | — |
| `docker-compose.yml` | `pgvector/pgvector:pg16` dev (:5432) + test (:5433, tmpfs) |
| `vitest.config.ts` | `unit` + `integration` projects |
| `playwright.config.ts` | `next dev` with `E2E_TEST_AUTH=1`, seeded fixture catalogue |
| `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts` | Sentry |
| `README.md` | Setup, catalogue pipeline, testing, deploying |
| `PLAN.md` | This file |

### 9.2 CI and migrations

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | lint + typecheck + unit; integration (pgvector service, migrate); e2e (seeded catalogue) |
| `.github/pull_request_template.md` | — |
| `drizzle/0000_extensions.sql` | `CREATE EXTENSION IF NOT EXISTS vector;` |
| `drizzle/0001_init.sql` ✱ | All tables (§6) |
| `drizzle/0002_indexes.sql` | HNSW on `catalogue_item.embedding`, GIN on `room_types`, partial index on live in-stock items |
| `drizzle/meta/*` ✱ | — |

### 9.3 `src/db/`

| File | Purpose |
|---|---|
| `src/db/index.ts` | Client + `drizzle()` |
| `src/db/schema/auth.ts` ✱ | Better Auth tables |
| `src/db/schema/catalogue.ts` | `catalogue_item`, `style` |
| `src/db/schema/projects.ts` | `project`, `project_invite`, `participant` |
| `src/db/schema/swipes.ts` | `swipe`, `veto`, `bridge_round` |
| `src/db/schema/synthesis.ts` | `synthesis`, `board_feedback` |
| `src/db/schema/clicks.ts` | `outbound_click` |
| `src/db/schema/index.ts` | Re-exports |

### 9.4 `src/lib/` — server logic

| File | Purpose |
|---|---|
| `src/lib/env.ts` | Zod-parsed env |
| `src/lib/ids.ts` | `newId()` |
| `src/lib/errors.ts` | `AppError`, `NotFound`, `Forbidden`, `Conflict` |
| `src/lib/auth.ts` | `betterAuth({ socialProviders: { google }, plugins: [anonymous({ onLinkAccount })] })` — `onLinkAccount` moves a guest's participants to their Google user |
| `src/lib/auth-client.ts` | Browser client (`signIn.social`, `signIn.anonymous`) |
| `src/lib/session.ts` | `getSession()`, `requireSession()`, `requireAdmin()` |
| `src/lib/permissions.ts` | `requireParticipant(projectId)`, `requireCreator(projectId)` |
| `src/lib/crypto.ts` | `randomToken()`, `sha256()` |
| `src/lib/taxonomy.ts` | §7.1 + Zod enums |
| `src/lib/budget.ts` | Budget bands → price limits per category |
| `src/lib/projects.ts` | Create project (builds decks), list mine, rename, delete |
| `src/lib/invites.ts` | Create/revoke invite, accept (join as participant, max 4) |
| `src/lib/swipes.ts` | Record/undo swipe, mark round done, record veto |
| `src/lib/reveal.ts` | Is the board revealed? (R10) |
| `src/lib/board.ts` | Assemble the board view-model from the latest synthesis + items |
| `src/lib/project-state.ts` | Polling payload: participants, progress, reveal, synthesis status |
| `src/lib/notify.ts` | Send "board ready" email (Resend), once per project |
| `src/lib/analytics.ts` | Server-side PostHog capture helper |
| `src/lib/unsplash.ts` | Search, map to catalogue rows, `trackDownload()` (called when a photo enters a deck) |
| `src/lib/catalogue/feeds.ts` | Download + parse Awin feeds (csv-parse + Zod) |
| `src/lib/catalogue/category-map.ts` | Merchant category → our category |
| `src/lib/catalogue/upsert.ts` | Upsert items by (source, source_id) |
| `src/lib/catalogue/refresh.ts` | Nightly price/stock/retire logic |
| `src/lib/ai/anthropic.ts` | Client, `CLAUDE_MODEL = "claude-opus-5-5"`, `parseStructured()` helper (stop_reason/refusal checks) |
| `src/lib/ai/schemas.ts` | `ItemTagsSchema`, `BridgeNameSchema` |
| `src/lib/ai/prompts/tag-item.ts` | Tagging system prompt (taxonomy, cached) + per-item content |
| `src/lib/ai/prompts/bridge-name.ts` | Naming prompt |
| `src/lib/ai/tag-batch.ts` | Build/poll/collect a tagging batch |
| `src/lib/ai/bridge-name.ts` | `nameBridge(input)` with fallback |
| `src/lib/embeddings/voyage.ts` | `embedItems()`, `embedText()` |
| `src/lib/engine/vector.ts` | `dot`, `cosine`, `normalise`, `mean`, `weightedMean` |
| `src/lib/engine/rng.ts` | Seeded PRNG + shuffle |
| `src/lib/engine/quotas.ts` | Micro category quotas per room type |
| `src/lib/engine/deck.ts` | §8.1 farthest-point sampling + style coverage |
| `src/lib/engine/profile.ts` | §8.2 taste vector, affinities, top styles, confidence |
| `src/lib/engine/matches.ts` | §8.3 steps 1–3 |
| `src/lib/engine/bridge.ts` | §8.3 step 4 maximin style |
| `src/lib/engine/compromise.ts` | §8.3 steps 5–6 scoring + MMR |
| `src/lib/engine/synthesise.ts` | Orchestrates the engine, computes `inputs_hash` |
| `src/lib/engine/tiebreak.ts` | §8.4 card selection |
| `src/lib/synthesis.ts` | Load inputs from DB, run engine, persist, schedule naming in `after()` |
| `src/lib/validation.ts` | Zod schemas for every action/route input |

### 9.5 `src/app/` — routes

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Shell, fonts, providers, toaster, footer with affiliate disclosure |
| `src/app/globals.css` | Tailwind + theme tokens |
| `src/app/providers.tsx` | TanStack Query, PostHog provider |
| `src/app/manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.png` | Installable PWA |
| `src/app/page.tsx` | Landing: "Settle your room style together in 5 minutes" → Start |
| `src/app/start/page.tsx` | Pick room type, optional name + budget → sign in with Google if needed → create |
| `src/app/start/actions.ts` | `createProject` |
| `src/app/projects/page.tsx` | My projects (status per project) |
| `src/app/r/[projectId]/page.tsx` | Project hub: participants + progress, invite link + QR + share button, "Start/continue swiping", board link when revealed, "Show results now" (creator) |
| `src/app/r/[projectId]/actions.ts` | `regenerateInvite`, `revokeInvite`, `forceReveal`, `deleteProject` |
| `src/app/r/[projectId]/swipe/page.tsx` | Swipe flow: macro → "Halfway! Now the pieces" interstitial → micro → done |
| `src/app/r/[projectId]/swipe/actions.ts` | `recordSwipe`, `undoSwipe`, `recordVeto`, `finishRound` |
| `src/app/r/[projectId]/board/page.tsx` | The shared board |
| `src/app/r/[projectId]/board/actions.ts` | `startTiebreak`, `boardFeedback` |
| `src/app/r/[projectId]/tiebreak/page.tsx` | Tie-breaker swipes (reuses the swipe stack) |
| `src/app/j/[token]/page.tsx` | Join: "Rich wants your take on the Living Room" → first name → Go |
| `src/app/j/[token]/actions.ts` | `joinProject` (anonymous sign-in if no session) |
| `src/app/go/[itemId]/route.ts` | Log `outbound_click`, 302 to `affiliate_url` (`rel="sponsored nofollow"` on links) |
| `src/app/admin/catalogue/page.tsx` | Catalogue review + coverage grid |
| `src/app/admin/catalogue/actions.ts` | Approve, retire, edit tags, bulk |
| `src/app/admin/metrics/page.tsx` | Simple DB-backed counts (projects, completion, clicks) as a PostHog backup |
| `src/app/privacy/page.tsx`, `src/app/disclosure/page.tsx` | Privacy (guest data, analytics) + affiliate disclosure |
| `src/app/not-found.tsx`, `src/app/error.tsx` | — |
| `src/app/api/auth/[...all]/route.ts` | Better Auth handler |
| `src/app/api/projects/[projectId]/state/route.ts` | Polling JSON |
| `src/app/api/projects/[projectId]/qr/route.ts` | Invite QR as SVG |
| `src/app/api/cron/refresh-feeds/route.ts` | Nightly refresh (checks `CRON_SECRET`) |
| `src/app/api/test/sign-in/route.ts` | E2E-only |
| `src/proxy.ts` | Redirect signed-out users away from `/projects`, `/start` (create step), `/admin` |

### 9.6 `src/components/`

| File | Purpose |
|---|---|
| `src/components/ui/*` ✱ | shadcn: button, card, dialog, sheet, input, label, select, tabs, sonner, avatar, badge, progress, skeleton, tooltip |
| `src/components/Header.tsx` | Logo, user menu / "Save with Google" for guests |
| `src/components/RoomTypePicker.tsx` | Big tappable room tiles |
| `src/components/BudgetPicker.tsx` | £ / ££ / £££ |
| `src/components/InvitePanel.tsx` | Copy link, native share (`navigator.share`), QR |
| `src/components/ParticipantProgress.tsx` | Avatars with "12/30 swiped" / "done" |
| `src/components/SwipeDeck.tsx` | Card stack: gestures, fling thresholds, keyboard ←/→, buttons, undo, image preloading (next 3), progress |
| `src/components/SwipeCard.tsx` | Full-bleed image, title/price (micro), attribution (macro) |
| `src/components/VetoSheet.tsx` | Confirm veto + optional "what's the deal-breaker?" tag chips, tokens left |
| `src/components/RoundInterstitial.tsx` | Macro → micro transition |
| `src/components/WaitingForOthers.tsx` | After finishing: share again, "we'll email you" |
| `src/components/board/BridgeStyleHero.tsx` | Bridge name, tagline, rationale, contributions, hybrid room photos |
| `src/components/board/AgreedItems.tsx` | Exact micro matches with buy buttons |
| `src/components/board/LovedRooms.tsx` | Exact macro matches |
| `src/components/board/SharedElements.tsx` | "You both love" / "You differ on" chips |
| `src/components/board/CompromisePicks.tsx` | Compromise products with per-person fit bars |
| `src/components/board/Vetoes.tsx` | Each person's deal-breakers |
| `src/components/board/TiebreakCta.tsx` | Start tie-breaker |
| `src/components/board/BoardFeedback.tsx` | "Did this help you agree?" 👍/👎 |
| `src/components/ProductCard.tsx` | Image, retailer, price, stock, Buy (→ `/go/[id]`) |
| `src/components/Attribution.tsx` | Unsplash/Pexels credit with links |
| `src/components/AffiliateNotice.tsx` | Inline disclosure |
| `src/components/admin/CatalogueGrid.tsx`, `src/components/admin/CoverageGrid.tsx`, `src/components/admin/TagEditor.tsx` | Admin |
| `src/hooks/useProjectState.ts` | Polls state (3 s while someone's swiping, stops when revealed) |
| `src/emails/BoardReady.tsx` | React Email template |

### 9.7 `scripts/`

`scripts/import-photos.ts`, `scripts/import-feed.ts`, `scripts/tag-catalogue.ts`, `scripts/embed-catalogue.ts`, `scripts/build-style-centroids.ts`, `scripts/seed-dev.ts` (§7.2).

### 9.8 `tests/`

| File | Purpose |
|---|---|
| `tests/setup/msw.ts` | MSW server |
| `tests/mocks/anthropic.ts`, `voyage.ts`, `unsplash.ts`, `resend.ts` | Fake APIs |
| `tests/fixtures/catalogue.json` | ≈ 120 items, synthetic vectors, tags (also the dev seed) |
| `tests/fixtures/industrial-vs-minimalist.json` | §8.5 |
| `tests/fixtures/awin-feed.csv` | Sample feed incl. bad rows |
| `tests/helpers/db.ts` | Reset + factories |
| `tests/helpers/vectors.ts` | Build synthetic vectors near given anchors |
| `tests/unit/vector.test.ts` | Maths helpers |
| `tests/unit/deck.test.ts` | Same cards for all, coverage constraint, quotas, budget filter, determinism by seed |
| `tests/unit/profile.test.ts` | Taste vector direction, Laplace affinity, confidence |
| `tests/unit/matches.test.ts` | Double rights, vetoes excluded, shared/conflict thresholds |
| `tests/unit/bridge.test.ts` | Maximin picks the in-between style; "already agree" case |
| `tests/unit/compromise.test.ts` | Vetoed attributes excluded, left-swiped excluded, MMR diversity, ≤ 2 per category |
| `tests/unit/synthesise.test.ts` | §8.5 fixture end to end; N = 3 participants |
| `tests/unit/feeds.test.ts` | Parsing, category mapping, bad rows skipped |
| `tests/unit/ai-schemas.test.ts` | Valid/invalid AI outputs; fallback naming |
| `tests/integration/invites.test.ts` | Join, max 4, expiry, revoke |
| `tests/integration/swipes.test.ts` | Idempotent swipes, undo, veto tokens can't go below 0 |
| `tests/integration/reveal.test.ts` | Hidden until finished; force reveal needs ≥ 2 finished |
| `tests/integration/guest-upgrade.test.ts` | Guest links Google, keeps participant + swipes |
| `tests/integration/access-control.test.ts` | Non-participants get 404 everywhere |
| `tests/integration/refresh.test.ts` | Price/stock update, retire after 3 misses |
| `tests/e2e/two-partners.spec.ts` | A creates → B joins in a second context → both swipe → board shows a match, a bridge name and compromise picks |
| `tests/e2e/veto.spec.ts` | Veto with attribute → no compromise pick carries it |
| `tests/e2e/tiebreak.spec.ts` | Tie-breaker mutual yes moves into Agreed |
| `tests/e2e/mobile-swipe.spec.ts` | Touch-drag swipe on a phone viewport |

---

## 10. Build order

### Phase 0 — Skeleton (½ day)

- [ ] Next.js app, pnpm, Tailwind, shadcn, ESLint/Prettier, Vitest, Playwright, MSW, CI, Docker Compose with pgvector, `env.ts`.
- [ ] Deploy a landing page to Vercel + Neon (needed early for the Awin/Unsplash applications).

**Done when:** CI is green and the landing page is live on your domain.

### Phase 1 — Catalogue pipeline (4–5 days, plus your curation time)

- [ ] Taxonomy, catalogue schema, import scripts (Unsplash, Awin), tagging (Batches), embeddings, style centroids, dev seed.
- [ ] `/admin/catalogue` review + coverage grid.
- [ ] Curate the living room first: ≈ 150 photos + ≈ 400 products live, every style with ≥ 15 items.

**Done when:** the coverage grid for living room has no empty style × tier cells; spot-check 30 random items and agree with ≥ 27 of their tags.

### Phase 2 — Projects, sign-in, guests, invites (2 days)

- [ ] Better Auth (Google + anonymous + link), `/start`, `/projects`, project hub, invite link + QR + share, `/j/[token]`, permissions.

**Done when:** on prod, you create a Living Room project, scan the QR on another phone, type a name, and appear on the hub as the second participant without creating an account; a third browser without the link gets 404.

### Phase 3 — Swiping (3 days)

- [ ] Deck builder + tests, `SwipeDeck` (gestures, keyboard, buttons, undo, preloading), persistence, interstitial, vetoes with attribute chips, waiting screen, Unsplash download pings.

**Done when:** 30 swipes take under 3 minutes on a mid-range phone with no image pop-in; closing the tab mid-deck and reopening resumes at the right card; a 4th veto is impossible.

### Phase 4 — Synthesis and the board (4 days)

- [ ] Engine (profile, matches, bridge, compromise) test-first with the §8.5 fixture; persistence; naming in `after()` with fallback; board UI; `/go` redirect + disclosure; "board ready" email.

**Done when:** you and someone with clearly different taste get a board with a bridge name you both find plausible, ≥ 8 compromise picks, no vetoed items, and working buy links that register clicks; `synthesise.test.ts` passes.

### Phase 5 — Tie-breaker round (1–2 days)

**Done when:** a mutual yes in the tie-breaker moves the item into Agreed and the board version increments; a third round isn't offered.

### Phase 6 — Bedroom + dining, analytics, launch (3 days)

- [ ] Curate bedroom and dining catalogues; PostHog funnels for §1 (cookieless until consent); Sentry; nightly refresh cron; privacy + disclosure pages; accessibility pass (buttons for every gesture, alt text from tags, contrast); README.

**Done when:** all E2E specs pass; 5 real couples complete a project unassisted and the funnel dashboard shows their times.

**Rough total:** ~3 weeks of engineering + several days of catalogue curation.

---

## 11. Analytics events (PostHog)

`project_created` (room_type, budget_band) · `invite_shared` (method: copy/share/qr) · `invite_opened` · `partner_joined` · `swipe` (round, value, decision_ms — sampled) · `veto_used` (with_attribute) · `round_finished` (round, duration_ms) · `board_revealed` (participants, exact_matches, forced) · `bridge_named` (ai_ok/fallback) · `tiebreak_started/finished` · `board_feedback` (helpful) · `buy_clicked` (retailer, category, price band) · `guest_upgraded`.

Funnel: project_created → invite_opened → partner_joined → round_finished(micro, partner) → board_revealed → board_feedback / buy_clicked.

---

## 12. Running locally

```bash
pnpm install
cp .env.example .env        # only DATABASE_URL, TEST_DATABASE_URL, BETTER_AUTH_*, GOOGLE_* needed for dev
pnpm db:up && pnpm db:migrate
pnpm db:seed                # fixture catalogue, no API keys needed
pnpm dev                    # http://localhost:3000
```

The catalogue scripts need the Anthropic, Voyage, Unsplash and Awin keys; run them against a branch DB on Neon first.

---

## 13. Costs

| Item | Cost | Notes |
|---|---|---|
| Tagging the catalogue (≈ 1,700 items at launch, Batches) | ≈ $10 one-off | Opus 5.5 at effort `low`; new items only afterwards |
| Embeddings | < $1 one-off | |
| Bridge naming | ≈ $0.01 per board version | The only per-user AI cost |
| Unsplash, Awin, PostHog, Resend, Sentry, Neon, Vercel | Free tiers cover the MVP | Check limits before a launch spike |

Marginal cost per couple is about a cent, which suits an affiliate revenue model.

---

## 14. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **The catalogue is the product.** Bad or samey cards make the synthesis meaningless. | Budget real curation time; coverage grid; spot-check tags; retire weak images ruthlessly. |
| R2 | **Affiliate approvals.** Retailers on Awin approve publishers manually; some want an established site. | Launch the landing page in Phase 0; apply widely; Skimlinks as a fallback for any retailer. The MVP works without revenue: buy buttons can be plain links at first. |
| R3 | **Unsplash terms.** Hotlinking, attribution and download pings are mandatory; production access is reviewed. | Built into `SwipeCard`/`Attribution` and the deck builder from day one. Pexels as a second source. |
| R4 | **30 swipes is a thin signal.** | Diverse decks (farthest-point sampling), macro weighted ×1.5, Laplace smoothing, a confidence indicator, and the tie-breaker round to firm things up. |
| R5 | **Partner B drop-off.** | One tap + first name to start; progress bar; total under 3 minutes; measured as the top funnel metric. |
| R6 | **Stale prices / dead links.** | Nightly refresh; hide buy buttons when out of stock; retire after 3 missing nights. |
| R7 | **UK/EU privacy (guests, analytics).** | Guest data is just a name + swipes; PostHog cookieless until consent; delete project deletes swipes; privacy page. |
| R8 | **AI names something silly.** | Name constrained to taxonomy vocabulary, validated, with a deterministic fallback; the maths never depends on it. |
| R9 | **Someone already built this.** | Before Phase 1, spend an hour searching the App Store / Play Store / Product Hunt for "couples interior swipe" apps and note how they differ. The reconciliation layer (bridge style + maximin compromise) is the part to protect. |

---

## 15. After the MVP (v2 ideas)

- **See it in your room:** upload a photo of the real room and render the agreed board into it with an image-editing model (the mock-up pipeline from Revision 1: Claude writes the brief, an image model renders, Vercel Blob stores).
- **Floorplans:** read a floorplan to know room sizes and filter products that won't fit.
- **Whole-home projects:** several rooms sharing one taste profile, so the second room starts with a smarter deck.
- **Adaptive decks:** a second macro round chosen from where the two taste vectors disagree most.
- **More rooms:** kitchen and bathroom (finish- and fixture-led decks).
- **"Add your own" cards:** paste a product link or screenshot into the deck for the partner to swipe.
- **Native app** if the web funnel proves out.
