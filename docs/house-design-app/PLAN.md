# Hearth — Build Plan

**Hearth** (working name, change it freely) is a shared house-design app. You sign in with Google and create a page for a property. Other people (a partner, family, a designer) join it from an invite link. Everyone links their own Pinterest account and picks which boards to share with the property. Hearth reads those pins, works out which ideas the members have *in common*, and suggests them for specific rooms. Upload a floorplan and Hearth finds the rooms. Upload photos of the real rooms and it renders mock-ups of those rooms restyled with the shared Pinterest ideas.

This document covers everything needed to build v1: the technology, the external accounts, every file, the data model, the AI pipeline, the build order and the risks. No code exists yet. Each phase ends with acceptance criteria, so whoever builds it knows when the phase is done.

> This plan sits in the `brock` repo only because that's where it was written. Hearth is a separate app: create a new repo (e.g. `rcon-tech/hearth`) and copy this file in as its `PLAN.md`. It deliberately reuses the Brock stack (Next.js 16, Drizzle, Postgres, Vitest, Playwright, Vercel + Neon), so nothing here is new territory except the AI and Pinterest parts.

---

## 1. Product decisions (decide these first)

These defaults turn the brief into exact rules. Change any that don't match what you want before building.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Sign-in | **Google only** (OpenID Connect: `openid email profile`) | The brief asks for it, and these scopes need no Google verification review. |
| D2 | Property roles | **Owner** (one, the creator), **Editor** (add rooms, upload, generate mock-ups), **Viewer** (look and react) | Lets you invite a builder or designer read-only. |
| D3 | Joining | **Invite link** with a role, expiring after 7 days, revocable, usable by many people until it expires | No email service needed for v1. Copy the link into WhatsApp. |
| D4 | Pinterest privacy | A member links Pinterest **once** per Hearth account, then picks **which boards** to share **per property**. Nothing is shared by default. | People have boards they don't want a partner's builder to see. |
| D5 | Secret boards | Off in v1 (only the `boards:read` / `pins:read` scopes) | Fewer scopes = easier Pinterest app review. Add `*_secret` scopes later if asked. |
| D6 | "Similar items" | Two pins are similar when their **image embeddings** are close (cosine similarity ≥ a tuned threshold, start at 0.82) **or** they share a detected item with the same category + material/colour. | Embeddings catch "same vibe"; item tags catch "you both saved a rattan pendant". |
| D7 | A suggestion | A **cluster** of similar pins, scored by how many *different members* saved something in it, assigned to a **room**. Single-member clusters still show, ranked below shared ones. | The point is the overlap between people. |
| D8 | Rooms | Come from the floorplan analysis **or** are added by hand. The floorplan result is always a draft the user confirms. | Vision models misread floorplans; a human check is cheap. |
| D9 | Mock-ups | Generated from **one real room photo** + **up to 6 pins** from one suggestion. The room's walls, windows, floor plan and camera angle must stay; furniture, finishes and colours change. | Keeps mock-ups recognisably *your* room. |
| D10 | Re-sync | Pinterest boards re-sync **nightly** and on demand ("Sync now", limited to once per 10 minutes). | Pins change; the Pinterest rate limit is finite. |
| D11 | Disconnecting | Unlinking Pinterest **deletes** that member's pins, analysis and embeddings from Hearth, and recomputes suggestions. Leaving a property removes their boards from it. | Required by Pinterest's developer terms, and the right thing anyway. |
| D12 | Device | **Mobile-first responsive web app** (works installed to the home screen). No native app in v1. | People take room photos on their phone. |

---

## 2. Technology (every piece)

### 2.1 Runtime, framework, UI

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Language | TypeScript | 5.9 | Everything, front and back |
| Runtime | Node.js | 24 (`.nvmrc`), engines `>=22` | Server, jobs, tooling |
| Package manager | pnpm | 10 | Install, scripts, lockfile |
| Framework | Next.js (App Router) | 16 | Pages, Server Components, Server Actions, route handlers, `proxy.ts` |
| UI library | React | 19 | Components |
| Styling | Tailwind CSS | 4 (`@tailwindcss/postcss`) | All styling |
| Component kit | shadcn/ui (copied into `src/components/ui`, built on Radix UI primitives) | latest CLI | Buttons, dialogs, dropdowns, tabs, toasts, sheet, avatar |
| Icons | lucide-react | latest | Icons |
| Client data | TanStack Query | 5 | Polling job status (sync, analysis, mock-ups) |
| Validation | Zod | 4 | Every request body, form, env var and AI structured output |

### 2.2 Data, auth, storage, jobs

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Database | PostgreSQL + **pgvector** | Postgres 16, pgvector 0.8 | All data, plus vector search over pin embeddings |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45 / 0.31 | Schema, queries, `vector()` column, `cosineDistance()` |
| Driver | `postgres` (postgres.js) | 3 | DB connection |
| Auth | **Better Auth** with the Google social provider + Drizzle adapter | 1.x | Google sign-in, sessions (cookie), `user/session/account/verification` tables |
| Pinterest OAuth | Hand-written OAuth 2.0 code flow (not Better Auth) | — | Pinterest is a *linked data source*, not a way to sign in, so it gets its own tokens table and refresh logic |
| Token encryption | `node:crypto` AES-256-GCM | built-in | Encrypt Pinterest access/refresh tokens at rest |
| File storage | **Vercel Blob** (`@vercel/blob`, client uploads) | 2.x | Floorplans, room photos, generated mock-ups |
| Background jobs | **Inngest** (`inngest` SDK, served from a Next route) | 3.x | Pinterest sync, pin analysis, clustering, floorplan/room analysis, mock-up generation, nightly cron. Retries, step functions, concurrency + throttle limits. |

### 2.3 AI and external APIs

| Job | Service | Model / endpoint | Why this one |
|---|---|---|---|
| Tag every pin (room type, style, items, materials, colours) | **Anthropic Claude API** (`@anthropic-ai/sdk`) via the **Message Batches API** (50% cheaper, async) | `claude-opus-5-5`, effort `low`, structured output (Zod schema) | Strong vision, reliable structured JSON |
| Analyse a floorplan (rooms, sizes, positions) | Claude API | `claude-opus-5-5`, effort `high`, structured output | Hardest reasoning task in the app |
| Analyse a room photo (type, fixed features, viewpoint, lighting) | Claude API | `claude-opus-5-5`, effort `medium`, structured output | — |
| Name and explain a suggestion ("You both saved warm oak + boucle") | Claude API | `claude-opus-5-5`, effort `low` | Short text |
| Write the image-edit brief for a mock-up | Claude API | `claude-opus-5-5`, effort `medium`, structured output | Turns pins + room analysis into a precise edit instruction |
| Image embeddings for "similar" | **Voyage AI** multimodal embeddings (`voyageai` SDK) | `voyage-multimodal-3` (1024-dim; use the newest multimodal model when you start) | Anthropic has no embeddings endpoint; Voyage is the provider Anthropic recommends, and its multimodal model embeds images and text in one space |
| Generate the mock-up image | **Google Gemini API** (`@google/genai`) | Gemini image model ("Nano Banana Pro", `gemini-3-pro-image-preview` at time of writing; confirm the current id) | Claude doesn't generate images. This model edits a source photo using several reference images and keeps the room's geometry well. Wrapped behind a `MockupRenderer` interface so FLUX Kontext (via fal.ai) or OpenAI's image model can be swapped in. |
| Pinterest data | **Pinterest API v5** (REST, `fetch`) | `/v5/user_account`, `/v5/boards`, `/v5/boards/{id}/pins` | The only sanctioned way to read pins |

All Claude calls: `thinking: { type: "adaptive" }`, an explicit `output_config.effort`, `client.messages.parse()` with a Zod schema for JSON results, and the server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) on the live (non-batch) calls. Always check `stop_reason` before reading content.

> **Cost lever:** pin tagging is the high-volume call. If the bill matters more than tag quality, switching just that one call to `claude-haiku-5-5` cuts its cost by roughly 40×. Measure tag quality on 50 pins before deciding.

### 2.4 Quality, testing, delivery

| Layer | Choice | Purpose |
|---|---|---|
| Unit + integration tests | Vitest 3 (two projects: `unit`, `integration`) | Logic + DB tests |
| HTTP mocking | MSW (Mock Service Worker) 2 | Fake Pinterest, Anthropic, Voyage, Gemini in tests; no real API calls in CI |
| E2E tests | Playwright | Full flows in a browser, with a test-only sign-in bypass |
| Lint / format | ESLint 9 (`eslint-config-next`) + Prettier 3 | — |
| Type check | `tsc --noEmit` | — |
| CI | GitHub Actions | Lint, typecheck, unit, integration (Postgres+pgvector service), E2E |
| Local DB | Docker Compose, `pgvector/pgvector:pg16` image | Dev DB on :5432, test DB on :5433 |
| Hosting | Vercel (app + Blob + cron-free; Inngest does scheduling) | — |
| Prod database | Neon Postgres (pgvector enabled: `CREATE EXTENSION vector`) | — |
| Error monitoring | Sentry (`@sentry/nextjs`) | Errors from pages, routes and Inngest functions |

---

## 3. Accounts and keys to set up before coding (Day 0)

Do these first; Pinterest approval in particular has lead time.

1. **Google Cloud** → new project → *Google Auth Platform* → consent screen (External, app name, support email) → *Clients* → **Web application** OAuth client. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-prod-domain>/api/auth/callback/google`
   - Copy `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
2. **Pinterest** → developers.pinterest.com → *My apps* → **Connect app**. Fill in the app description honestly: "reads a user's chosen boards to suggest interior-design ideas shared between household members and render private mock-ups of their own rooms". Redirect URIs:
   - `http://localhost:3000/api/pinterest/callback`
   - `https://<your-prod-domain>/api/pinterest/callback`
   - Scopes: `user_accounts:read`, `boards:read`, `pins:read`.
   - New apps start on **Trial access** (low rate limits, limited who can connect). **Apply for Standard access as soon as Phase 2 works**: it needs a screen-recorded demo of the OAuth flow and how pins are used. Budget a couple of weeks.
   - Copy `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`.
   - Read the current Pinterest Developer Guidelines and API terms end to end before Phase 3 (see risk R1).
3. **Anthropic** → console.anthropic.com → API key → `ANTHROPIC_API_KEY`. Set a monthly spend limit.
4. **Voyage AI** → dash.voyageai.com → API key → `VOYAGE_API_KEY`.
5. **Google AI Studio** → API key for the Gemini API → `GEMINI_API_KEY`. Enable billing (image models aren't on the free tier).
6. **Neon** → project → database `hearth` → run `CREATE EXTENSION IF NOT EXISTS vector;` → `DATABASE_URL`.
7. **Vercel** → import the repo → add a **Blob** store (gives `BLOB_READ_WRITE_TOKEN`) → add env vars.
8. **Inngest** → app.inngest.com → connect the Vercel integration (gives `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`). Locally you use the Inngest dev server, no keys.
9. **Sentry** → Next.js project → `SENTRY_DSN` (Phase 7).
10. Generate secrets: `openssl rand -base64 32` for `BETTER_AUTH_SECRET` and again for `TOKEN_ENCRYPTION_KEY`.

### Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | App database |
| `TEST_DATABASE_URL` | Separate DB that integration/E2E tests wipe |
| `BETTER_AUTH_SECRET` | Signs session cookies |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally, the prod URL in prod |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | Pinterest OAuth |
| `PINTEREST_REDIRECT_URI` | Must exactly match a URI registered with Pinterest |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM |
| `ANTHROPIC_API_KEY` | Claude |
| `VOYAGE_API_KEY` | Embeddings |
| `GEMINI_API_KEY` | Mock-up images |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Jobs (prod only) |
| `SENTRY_DSN` | Errors (prod only) |
| `E2E_TEST_AUTH` | `1` only in E2E runs: enables `/api/test/sign-in` (never set in prod; the route also refuses when `NODE_ENV=production`) |
| `SIMILARITY_THRESHOLD` | Optional override for D6 (default `0.82`) |

---

## 4. Architecture

```
 Browser (Next.js pages, React 19, TanStack Query polling)
    │  Server Actions / route handlers
    ▼
 Next.js on Vercel ──────────────► Postgres (Neon) + pgvector
    │  inngest.send(event)                ▲
    ▼                                     │ writes results
 Inngest functions (durable steps, retries, throttles)
    ├─ pinterest/account.sync   ──► Pinterest API v5
    ├─ pins/analyse             ──► Claude (Batches) + Voyage embeddings
    ├─ property/suggestions.recompute (pure TS + pgvector queries + Claude for names)
    ├─ floorplan/analyse        ──► Claude vision
    ├─ room-photo/analyse       ──► Claude vision
    ├─ mockup/generate          ──► Claude (brief) ──► Gemini image ──► Vercel Blob
    └─ cron: nightly re-sync
 Uploads: browser ──(client upload token)──► Vercel Blob; DB stores the blob URL
```

Rules of the road:

- **Pages never call an AI or Pinterest API directly.** They write a row with `status = 'queued'`, send an Inngest event, and poll a status endpoint. Everything slow is a job.
- **Every AI result is validated with Zod** before it touches the DB. A result that fails validation marks the row `failed` with the reason; it is retried once by Inngest, then shown to the user as "couldn't analyse, try again".
- **Every query is scoped by property membership.** One helper, `requireMember(propertyId, minRole)`, is called at the top of every server action and route that takes a `propertyId`.
- Pinterest analysis is stored **per pin, not per property**: if two properties share the same member's board, the pin is tagged and embedded once.

---

## 5. Data model

All ids are `text` (cuid2-style, generated in app code) except Better Auth's own tables, which use what its CLI generates. All tables have `created_at timestamptz default now()`.

### 5.1 Auth (generated by Better Auth CLI)

`user` (id, name, email, email_verified, image, created_at, updated_at) · `session` · `account` (Google link) · `verification`.

### 5.2 Properties and membership

| Table | Columns | Notes |
|---|---|---|
| `property` | id, name, address (nullable), cover_image_url (nullable), created_by → user | |
| `property_member` | property_id → property, user_id → user, role `owner|editor|viewer`, joined_at | PK (property_id, user_id). Exactly one owner per property (partial unique index on `role = 'owner'`). |
| `property_invite` | id, property_id, token_hash (sha256 of the URL token), role `editor|viewer`, created_by, expires_at, revoked_at (nullable), use_count | Raw token appears only in the link. |

### 5.3 Pinterest

| Table | Columns | Notes |
|---|---|---|
| `pinterest_connection` | user_id (PK) → user, pinterest_user_id, username, profile_image, access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, scopes, last_synced_at, sync_status `idle|queued|running|failed`, sync_error | Tokens AES-256-GCM encrypted (`iv:tag:ciphertext` base64). |
| `pinterest_board` | id (Pinterest board id, PK), owner_user_id → user, name, description, pin_count, image_url, updated_at | |
| `pinterest_pin` | id (Pinterest pin id, PK), board_id → board, owner_user_id → user, title, description, link (outbound), image_url (largest available), image_width, image_height, dominant_color, pinned_at, removed_at (nullable, set when the pin disappears on re-sync) | |
| `property_board` | property_id, board_id, shared_by_user_id | Which of a member's boards are shared into which property (D4). PK (property_id, board_id). |

### 5.4 Analysis

| Table | Columns | Notes |
|---|---|---|
| `pin_analysis` | pin_id (PK) → pin, status `queued|done|failed|skipped`, is_interior bool, room_types text[], styles text[], palette text[] (hex), items jsonb (`[{category, description, material, colour}]`), summary text, model text, error text, analysed_at | `skipped` = not interior (recipes, outfits); excluded from suggestions |
| `pin_embedding` | pin_id (PK), embedding `vector(1024)`, model text | HNSW index: `USING hnsw (embedding vector_cosine_ops)` |

### 5.5 Rooms, uploads, suggestions, mock-ups

| Table | Columns | Notes |
|---|---|---|
| `floorplan` | id, property_id, blob_url, width, height, status `queued|running|done|failed`, raw_result jsonb, error, uploaded_by | |
| `room` | id, property_id, floorplan_id (nullable), name ("Kitchen"), room_type (enum, §7.1), width_m, length_m (nullable), bbox jsonb (`{x,y,w,h}` normalised 0–1 on the floorplan image, nullable), confirmed bool, sort_order | Manual rooms have no floorplan_id |
| `room_photo` | id, room_id, blob_url, width, height, status, analysis jsonb (§7.4), error, uploaded_by | |
| `suggestion` | id, property_id, room_id (nullable = "unassigned"), title, rationale, score real, member_count int, styles text[], palette text[], computed_at, version int | Rebuilt by the recompute job; `version` increments each run |
| `suggestion_pin` | suggestion_id, pin_id, is_representative bool | |
| `suggestion_reaction` | suggestion_id, user_id, value `-1|1` | Feeds the score (§7.3) |
| `mockup` | id, room_photo_id, suggestion_id, pin_ids text[], brief jsonb, prompt text, status `queued|running|done|failed`, blob_url (nullable), model text, error, created_by | |
| `mockup_reaction` | mockup_id, user_id, value `-1|1` | |

---

## 6. Pinterest integration (exact flow)

1. **Connect** — `GET /api/pinterest/connect` creates a random `state`, stores it in an httpOnly cookie (10 min), and redirects to `https://www.pinterest.com/oauth/?client_id=…&redirect_uri=…&response_type=code&scope=user_accounts:read,boards:read,pins:read&state=…`.
2. **Callback** — `GET /api/pinterest/callback?code&state`: check `state` against the cookie; `POST https://api.pinterest.com/v5/oauth/token` with HTTP Basic auth (`app_id:app_secret`) and form body `grant_type=authorization_code&code=…&redirect_uri=…`. Store both tokens encrypted with their expiries (read `expires_in` / `refresh_token_expires_in` from the response, don't hard-code them). Fetch `GET /v5/user_account` for username + avatar. Send `pinterest/account.sync`. Redirect back to where the user came from.
3. **Token refresh** — `getAccessToken(userId)` in `pinterest/tokens.ts`: if the access token expires within 5 minutes, `POST /v5/oauth/token` with `grant_type=refresh_token`, store the new pair. If refresh fails with 400/401, mark the connection `failed` with "Reconnect Pinterest" and stop.
4. **Sync** (Inngest, concurrency 1 per user, throttled globally to stay under the app's rate limit):
   - `GET /v5/boards?page_size=100` following `bookmark` until null → upsert `pinterest_board`.
   - For each board: `GET /v5/boards/{id}/pins?page_size=100` following `bookmark` → upsert `pinterest_pin` (pick the largest of `media.images` — `1200x`, then `600x`, then `originals`). Pins in the DB but not returned → set `removed_at`.
   - On 429: Inngest `step.sleep` for the `Retry-After` seconds (or 60 s) and resume. Each board is its own step, so a failure resumes mid-sync.
   - Send `pins/analyse` with the ids of new/changed pins, then `property/suggestions.recompute` for every property the user shares a board into.
5. **Disconnect** — delete the connection, boards, pins (cascades to analysis/embeddings/`property_board`/`suggestion_pin`), call Pinterest's token revocation if the API offers one at build time, recompute affected properties.
6. **Display rules** — always show a pin with its Pinterest attribution and link to `https://www.pinterest.com/pin/{id}/`. Never re-host pin images in Blob; hot-link `i.pinimg.com` (add it to `next.config.ts` `images.remotePatterns`).

---

## 7. AI pipeline (what each step does)

### 7.1 Shared vocabularies (`src/lib/taxonomy.ts`)

- **Room types:** kitchen, living_room, dining_room, bedroom, bathroom, ensuite, wc, hallway, office, nursery, kids_room, utility, garden, patio, garage, other.
- **Styles:** ~25 fixed labels (japandi, scandinavian, mid_century, modern_farmhouse, industrial, coastal, boho, minimalist, traditional, art_deco, maximalist, rustic, contemporary, mediterranean, wabi_sabi, …).
- **Item categories:** sofa, armchair, dining_table, chair, bed, rug, pendant_light, floor_lamp, wall_lamp, cabinetry, worktop, splashback, tiles, flooring, wall_colour, wallpaper, curtains, shelving, art, mirror, plant, tap, bath, shower, vanity, storage, fireplace, other.

Fixed vocabularies make tags comparable across members; free text goes in `description`.

### 7.2 Pin tagging + embedding (`pins/analyse`)

- Collect up to 500 pins per batch. Build one Claude Batches request per pin: system prompt (vocabularies, cached with `cache_control`), user content = the pin image by URL + title/description; `output_config.format` = JSON schema from `PinAnalysisSchema` (is_interior, room_types[], styles[], palette[], items[], summary).
- Poll the batch with `step.sleep("1m")` until `ended`, then validate each result keyed by `custom_id` (= pin id) and upsert `pin_analysis`.
- For pins with `is_interior = true`: call Voyage multimodal embeddings in chunks (image URL + summary text as one input) → upsert `pin_embedding`.
- Then send `property/suggestions.recompute` for affected properties.

### 7.3 Cross-referencing and suggestions (`property/suggestions.recompute`) — the core algorithm

Pure TypeScript in `src/lib/suggestions/`, unit-tested without any API:

1. **Gather** all non-removed, interior pins from boards shared into the property, with embeddings and tags, grouped by owner.
2. **Edges.** For each pin, pgvector query: top 20 nearest pins *in this property* (`ORDER BY embedding <=> $1 LIMIT 20`). Keep an edge when cosine similarity ≥ `SIMILARITY_THRESHOLD`, **or** the two pins share an item with the same category and (material or colour). Edge weight = similarity, +0.05 per shared item, capped at 1.
3. **Clusters.** Connected components over the edges, then split any component larger than 40 pins by re-running with the threshold +0.03 (prevents one "beige living room" blob swallowing everything). Single pins with no edges become singleton clusters.
4. **Score** each cluster:
   `score = 3 × distinct_members + mean_edge_weight + 0.5 × ln(pin_count) + Σ reactions (±1 each, from the previous version's matching suggestion)`.
   Cross-member clusters therefore always outrank single-member ones.
5. **Assign a room.** Majority vote of `room_types` across the cluster's pins → a room type. If the property has rooms of that type, assign to that room (if several, e.g. 3 bedrooms, assign to each and let the UI show it under all of them). If none, `room_id = null` ("Ideas without a room yet").
6. **Describe.** Representative pins = the 4 with the highest summed edge weight. One Claude call per cluster (effort `low`): given the representatives' summaries/tags and which members saved them, return `{title, rationale}` (e.g. *"Warm oak and sage" — You and Sam both saved light oak cabinetry with sage-green walls*). Skip clusters already described in the previous version with the same pin set (hash the sorted pin ids).
7. **Write** a new `version` of `suggestion` + `suggestion_pin` rows in one transaction; delete the old version.

Also computed (cheap, no AI): a **taste overlap** panel per property — the styles, colours and item categories that appear in pins from ≥2 members, with counts.

### 7.4 Floorplan analysis (`floorplan/analyse`)

- Input: the uploaded image (client resizes to ≤ 2048 px long edge before upload).
- Claude, effort `high`, schema `FloorplanSchema`: `{ units: "m"|"ft"|"unknown", rooms: [{ name, room_type, width, length, bbox: {x,y,w,h} (0–1), confidence }], notes }`. Prompt tells it to read printed labels and dimensions, convert feet to metres, and give its best bbox for each labelled room.
- Results go into `room` with `confirmed = false`. The **Floorplan editor** shows the image with the boxes drawn on top; users drag/resize boxes, rename, change type, delete, add, then press **Confirm rooms**. Only confirmed rooms take part in suggestions.

### 7.5 Room photo analysis (`room-photo/analyse`)

- Claude, effort `medium`, schema `RoomPhotoSchema`: `{ room_type, fixed_features: [windows, doors, fireplace, beams, radiators…], replaceable: [current furniture/finishes], lighting: "bright"|"mixed"|"dim", viewpoint, estimated_ceiling_height_m, current_styles[], quality_issues[] }`.
- If `room_type` disagrees with the room it was uploaded to, show a gentle warning ("This looks like a bathroom — move it?").
- If `quality_issues` contains "too dark"/"too blurry", ask for a better photo before allowing mock-ups.

### 7.6 Mock-up generation (`mockup/generate`)

1. **Brief** — Claude (effort `medium`, schema `MockupBriefSchema`) gets the room photo analysis, the suggestion's title/rationale, and the chosen pins' summaries/items. It returns `{ keep: [...fixed features...], change: [{ element, to }], palette, style, negative: [...] , prompt }`. The `prompt` is a single precise image-edit instruction: *keep the walls, windows, floor plan, ceiling and camera angle exactly; replace X with Y; use palette …*.
2. **Render** — `MockupRenderer.render({ roomPhoto, referenceImages (≤6 pin images), prompt })`. The Gemini implementation fetches all images, sends them inline with the prompt, and returns PNG bytes.
3. **Store** — upload bytes to Vercel Blob (`mockups/{propertyId}/{mockupId}.png`), set `blob_url`, `status = done`.
4. Concurrency: 2 mock-ups at a time per property, 10 globally; a user may have at most 5 queued. Each one costs real money (see §12).

The mock-up page shows a **before/after slider**, the source pins underneath (with Pinterest attribution), thumbs up/down, and "Try again" (same brief, new render) / "Different idea" (pick another suggestion).

---

## 8. Pages and API surface

### 8.1 Pages

| Route | What it shows |
|---|---|
| `/` | Signed out: landing + "Continue with Google". Signed in: redirect to `/properties`. |
| `/sign-in` | Google button (also where `proxy.ts` sends signed-out users, with `?next=`) |
| `/properties` | Your properties as cards + "New property" |
| `/properties/new` | Name + optional address → creates it, you're owner |
| `/p/[propertyId]` | Property home: members (avatars), rooms grid, "Ideas for every room" (top suggestions), taste-overlap panel, setup checklist (link Pinterest → share boards → upload floorplan → add room photos) |
| `/p/[propertyId]/boards` | Your Pinterest boards with toggles "share with this property"; status of sync/analysis |
| `/p/[propertyId]/members` | Members + roles (owner can change/remove), invite link generator, revoke |
| `/p/[propertyId]/floorplan` | Upload + floorplan editor (§7.4) |
| `/p/[propertyId]/rooms/[roomId]` | Room: photos (upload), suggestions for this room, mock-ups |
| `/p/[propertyId]/suggestions/[suggestionId]` | Suggestion: all pins (grouped by member), rationale, reactions, "Mock it up in…" room-photo picker |
| `/p/[propertyId]/mockups/[mockupId]` | Before/after viewer, reactions, retry |
| `/invite/[token]` | "Rich invited you to 12 Elm Road as an editor" → Join (sign in first if needed) |
| `/settings` | Your account, Pinterest connection (connect/disconnect, last sync), delete account |

### 8.2 Route handlers (everything else is a Server Action)

| Route | Purpose |
|---|---|
| `GET/POST /api/auth/[...all]` | Better Auth handler |
| `GET /api/pinterest/connect` | Start Pinterest OAuth |
| `GET /api/pinterest/callback` | Finish Pinterest OAuth |
| `POST /api/uploads` | Vercel Blob `handleUpload`: checks membership + role, file type (jpeg/png/webp), size (≤ 15 MB), returns a client upload token; `onUploadCompleted` creates the `floorplan`/`room_photo` row and sends its analyse event |
| `GET/POST/PUT /api/inngest` | Inngest `serve()` endpoint |
| `GET /api/p/[propertyId]/status` | JSON: sync/analysis/floorplan/photo/mock-up statuses for polling |
| `POST /api/test/sign-in` | E2E only (`E2E_TEST_AUTH=1` and not production): creates a user + session cookie |

### 8.3 Server Actions (`src/app/**/actions.ts`)

`createProperty`, `renameProperty`, `deleteProperty`, `createInvite`, `revokeInvite`, `acceptInvite`, `changeMemberRole`, `removeMember`, `leaveProperty`, `setBoardShared`, `syncPinterestNow`, `disconnectPinterest`, `updateRoom`, `addRoom`, `deleteRoom`, `confirmRooms`, `deleteRoomPhoto`, `reactToSuggestion`, `createMockup`, `retryMockup`, `reactToMockup`, `deleteAccount`. Each one: parse input with Zod → `requireSession()` → `requireMember()` → do it → `revalidatePath`.

---

## 9. Every file

Repo root of the new `hearth` repo. ✱ = generated by a tool, not hand-written.

### 9.1 Root

| File | Purpose |
|---|---|
| `package.json` | Deps + scripts: `dev`, `dev:jobs` (`inngest-cli dev`), `build`, `vercel-build` (migrate on prod then build), `lint`, `format`, `typecheck`, `db:up`, `db:generate`, `db:migrate`, `db:studio`, `test`, `test:integration`, `test:e2e` |
| `pnpm-lock.yaml` ✱ | Lockfile |
| `.nvmrc` | `24` |
| `.env.example` | All vars from §3, empty |
| `.gitignore` | `node_modules`, `.next`, `.env*` (not `.env.example`), `playwright-report`, `test-results`, `coverage` |
| `.prettierrc`, `.prettierignore` | Formatting |
| `eslint.config.mjs` | Next + TS rules |
| `tsconfig.json` | Strict, `@/*` → `src/*` |
| `next.config.ts` | `images.remotePatterns` for `i.pinimg.com` and the Blob host; Sentry wrapper (Phase 7) |
| `postcss.config.mjs` | Tailwind 4 |
| `components.json` | shadcn/ui config |
| `drizzle.config.ts` | Schema path, migrations dir, `DATABASE_URL` |
| `docker-compose.yml` | `pgvector/pgvector:pg16` on :5432 (`hearth`) and :5433 (`hearth_test`, tmpfs) |
| `vitest.config.ts` | `unit` (`tests/unit`) and `integration` (`tests/integration`, uses `TEST_DATABASE_URL`, single fork) projects |
| `playwright.config.ts` | Starts `next dev` with `E2E_TEST_AUTH=1` and MSW-backed fakes |
| `sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts` | Sentry (Phase 7) |
| `README.md` | What it is, setup, env vars, running jobs locally, testing, deploying |
| `PLAN.md` | This document |

### 9.2 `.github/`

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Jobs: lint+typecheck+unit; integration (service `pgvector/pgvector:pg16`, `db:migrate` first); e2e (Playwright, uploads report on failure) |
| `.github/pull_request_template.md` | Summary / testing / screenshots |

### 9.3 `drizzle/`

| File | Purpose |
|---|---|
| `drizzle/0000_extensions.sql` | Hand-written: `CREATE EXTENSION IF NOT EXISTS vector;` |
| `drizzle/0001_init.sql` ✱ | All tables from §5 |
| `drizzle/0002_indexes.sql` | Hand-written: HNSW index on `pin_embedding`, partial unique owner index, GIN on `pin_analysis.room_types` |
| `drizzle/meta/*` ✱ | Drizzle snapshots + journal |

### 9.4 `src/db/`

| File | Purpose |
|---|---|
| `src/db/index.ts` | postgres.js client + `drizzle()` instance (one per process) |
| `src/db/schema/auth.ts` ✱ | Better Auth tables (generated with `npx @better-auth/cli generate`, then committed) |
| `src/db/schema/property.ts` | `property`, `property_member`, `property_invite` |
| `src/db/schema/pinterest.ts` | `pinterest_connection`, `pinterest_board`, `pinterest_pin`, `property_board` |
| `src/db/schema/analysis.ts` | `pin_analysis`, `pin_embedding` |
| `src/db/schema/rooms.ts` | `floorplan`, `room`, `room_photo` |
| `src/db/schema/suggestions.ts` | `suggestion`, `suggestion_pin`, `suggestion_reaction` |
| `src/db/schema/mockups.ts` | `mockup`, `mockup_reaction` |
| `src/db/schema/index.ts` | Re-exports all schema files |

### 9.5 `src/lib/` — logic (no React)

| File | Purpose |
|---|---|
| `src/lib/env.ts` | Zod-parsed `process.env`; import `env` everywhere instead of `process.env` |
| `src/lib/ids.ts` | `newId()` |
| `src/lib/errors.ts` | `AppError` (code, status, user message), `NotFound`, `Forbidden`, `Conflict` |
| `src/lib/auth.ts` | `betterAuth({ database: drizzleAdapter(...), socialProviders: { google } })` |
| `src/lib/auth-client.ts` | `createAuthClient()` for the browser (`signIn.social({ provider: "google" })`, `signOut`) |
| `src/lib/session.ts` | `getSession()`, `requireSession()` (server only) |
| `src/lib/permissions.ts` | `requireMember(propertyId, minRole)`, `roleAtLeast()` |
| `src/lib/crypto.ts` | `encrypt()`, `decrypt()` (AES-256-GCM), `randomToken()`, `sha256()` |
| `src/lib/taxonomy.ts` | Room types, styles, item categories (§7.1) + Zod enums |
| `src/lib/properties.ts` | Create/rename/delete property, list a user's properties |
| `src/lib/invites.ts` | Create/accept/revoke invite links |
| `src/lib/members.ts` | Change role, remove, leave (owner can't leave without transferring) |
| `src/lib/pinterest/client.ts` | Typed `fetch` wrapper for v5: auth header, bookmark pagination iterator, 429 → `RateLimited(retryAfter)` |
| `src/lib/pinterest/oauth.ts` | Build authorize URL, exchange code, refresh token |
| `src/lib/pinterest/tokens.ts` | `getAccessToken(userId)` with refresh-on-expiry, `saveTokens()` |
| `src/lib/pinterest/types.ts` | Zod schemas for the v5 responses used (user_account, board, pin, paged list) |
| `src/lib/pinterest/sync.ts` | Upsert boards/pins, mark removed — called step-by-step from the Inngest function |
| `src/lib/pinterest/disconnect.ts` | Delete a user's Pinterest data |
| `src/lib/ai/anthropic.ts` | Shared `Anthropic` client, model constant `CLAUDE_MODEL = "claude-opus-5-5"`, `callStructured(schema, params)` helper (parse + refusal/stop-reason checks) |
| `src/lib/ai/schemas.ts` | Zod: `PinAnalysisSchema`, `FloorplanSchema`, `RoomPhotoSchema`, `SuggestionTextSchema`, `MockupBriefSchema` |
| `src/lib/ai/prompts/pin-analysis.ts` | System prompt + per-pin user content builder |
| `src/lib/ai/prompts/floorplan.ts` | Floorplan prompt |
| `src/lib/ai/prompts/room-photo.ts` | Room photo prompt |
| `src/lib/ai/prompts/suggestion-text.ts` | Title/rationale prompt |
| `src/lib/ai/prompts/mockup-brief.ts` | Mock-up brief prompt |
| `src/lib/ai/pin-analysis.ts` | Build a Batches request for N pins, collect + validate results |
| `src/lib/ai/floorplan.ts` | `analyseFloorplan(blobUrl)` |
| `src/lib/ai/room-photo.ts` | `analyseRoomPhoto(blobUrl)` |
| `src/lib/ai/suggestion-text.ts` | `describeCluster(cluster)` |
| `src/lib/ai/mockup-brief.ts` | `writeMockupBrief(roomAnalysis, suggestion, pins)` |
| `src/lib/embeddings/voyage.ts` | `embedPins(pins)` → `{pinId, vector}[]`, chunked |
| `src/lib/render/types.ts` | `MockupRenderer` interface |
| `src/lib/render/gemini.ts` | Gemini implementation (fetch images → inline parts → PNG bytes) |
| `src/lib/render/index.ts` | `getRenderer()` (one switch point for swapping providers) |
| `src/lib/storage.ts` | `putMockup(bytes)`, `deleteBlob(url)`, allowed content types/sizes |
| `src/lib/suggestions/gather.ts` | Load a property's pins + tags + embeddings |
| `src/lib/suggestions/edges.ts` | Build similarity edges (pgvector kNN + shared-item rule) |
| `src/lib/suggestions/cluster.ts` | Connected components + oversized-cluster split (pure) |
| `src/lib/suggestions/score.ts` | Scoring formula (pure) |
| `src/lib/suggestions/assign-room.ts` | Majority vote → room(s) (pure) |
| `src/lib/suggestions/overlap.ts` | Taste-overlap panel data (pure) |
| `src/lib/suggestions/recompute.ts` | Orchestrates the above, writes a new version transactionally |
| `src/lib/rooms.ts` | Room CRUD, `confirmRooms`, apply floorplan result |
| `src/lib/mockups.ts` | Create/retry mock-ups, enforce per-user queue limit |
| `src/lib/status.ts` | Build the polling status payload for a property |
| `src/lib/validation.ts` | Zod input schemas for every Server Action |

### 9.6 `src/inngest/` — jobs

| File | Purpose |
|---|---|
| `src/inngest/client.ts` | `new Inngest({ id: "hearth", schemas })` with typed events |
| `src/inngest/events.ts` | Event names + Zod payloads |
| `src/inngest/functions/sync-pinterest.ts` | `pinterest/account.sync` (§6.4) |
| `src/inngest/functions/nightly-sync.ts` | Cron `0 3 * * *`: fan out a sync per connection |
| `src/inngest/functions/analyse-pins.ts` | `pins/analyse` (§7.2) |
| `src/inngest/functions/recompute-suggestions.ts` | `property/suggestions.recompute`, debounced 60 s per property |
| `src/inngest/functions/analyse-floorplan.ts` | `floorplan/analyse` |
| `src/inngest/functions/analyse-room-photo.ts` | `room-photo/analyse` |
| `src/inngest/functions/generate-mockup.ts` | `mockup/generate` (§7.6) |
| `src/inngest/functions/index.ts` | Array of all functions for `serve()` |

### 9.7 `src/app/` — routes

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | HTML shell, fonts, `<Providers>`, `<Toaster>` |
| `src/app/globals.css` | Tailwind + shadcn theme tokens (light/dark) |
| `src/app/providers.tsx` | TanStack `QueryClientProvider` (client) |
| `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/manifest.ts` | Icon + installable PWA manifest |
| `src/app/page.tsx` | Landing / redirect |
| `src/app/sign-in/page.tsx` | Google sign-in |
| `src/app/properties/page.tsx` | Property list |
| `src/app/properties/new/page.tsx` | New property form |
| `src/app/properties/actions.ts` | `createProperty` |
| `src/app/p/[propertyId]/layout.tsx` | Loads property + membership (404 if not a member), property nav tabs |
| `src/app/p/[propertyId]/page.tsx` | Property home |
| `src/app/p/[propertyId]/actions.ts` | Property-level actions (rename, delete, leave) |
| `src/app/p/[propertyId]/boards/page.tsx` | Board sharing |
| `src/app/p/[propertyId]/boards/actions.ts` | `setBoardShared`, `syncPinterestNow` |
| `src/app/p/[propertyId]/members/page.tsx` | Members + invites |
| `src/app/p/[propertyId]/members/actions.ts` | Invite/role/remove actions |
| `src/app/p/[propertyId]/floorplan/page.tsx` | Floorplan upload + editor |
| `src/app/p/[propertyId]/floorplan/actions.ts` | Room edits, `confirmRooms` |
| `src/app/p/[propertyId]/rooms/[roomId]/page.tsx` | Room page |
| `src/app/p/[propertyId]/rooms/[roomId]/actions.ts` | Photo delete, `createMockup` |
| `src/app/p/[propertyId]/suggestions/[suggestionId]/page.tsx` | Suggestion detail |
| `src/app/p/[propertyId]/suggestions/[suggestionId]/actions.ts` | `reactToSuggestion` |
| `src/app/p/[propertyId]/mockups/[mockupId]/page.tsx` | Mock-up viewer |
| `src/app/p/[propertyId]/mockups/[mockupId]/actions.ts` | `retryMockup`, `reactToMockup` |
| `src/app/invite/[token]/page.tsx` | Accept invite |
| `src/app/invite/[token]/actions.ts` | `acceptInvite` |
| `src/app/settings/page.tsx` | Account + Pinterest connection |
| `src/app/settings/actions.ts` | `disconnectPinterest`, `deleteAccount` |
| `src/app/not-found.tsx`, `src/app/error.tsx` | Error pages |
| `src/app/api/auth/[...all]/route.ts` | Better Auth `toNextJsHandler(auth)` |
| `src/app/api/pinterest/connect/route.ts` | §6.1 |
| `src/app/api/pinterest/callback/route.ts` | §6.2 |
| `src/app/api/uploads/route.ts` | Blob `handleUpload` |
| `src/app/api/inngest/route.ts` | Inngest `serve()` |
| `src/app/api/p/[propertyId]/status/route.ts` | Polling status |
| `src/app/api/test/sign-in/route.ts` | E2E-only sign-in |
| `src/proxy.ts` | Next 16 proxy (formerly middleware): redirect signed-out users on `/properties`, `/p/*`, `/settings` to `/sign-in?next=` (cookie presence check only; real checks are server-side) |

### 9.8 `src/components/`

| File | Purpose |
|---|---|
| `src/components/ui/*` ✱ | shadcn/ui: button, card, dialog, dropdown-menu, input, label, select, tabs, sonner (toasts), avatar, badge, switch, skeleton, sheet, progress |
| `src/components/Header.tsx` | Logo, property switcher, user menu |
| `src/components/GoogleSignInButton.tsx` | Calls `authClient.signIn.social` |
| `src/components/PropertyCard.tsx` | Property tile |
| `src/components/SetupChecklist.tsx` | The 4 setup steps with ticks |
| `src/components/MemberAvatars.tsx` | Overlapping avatars |
| `src/components/MemberList.tsx` | Members table with role controls |
| `src/components/InviteLinkDialog.tsx` | Pick role → generate → copy link |
| `src/components/PinterestConnectButton.tsx` | Connect / reconnect state |
| `src/components/BoardShareList.tsx` | Board rows with share switches + counts |
| `src/components/SyncStatus.tsx` | Polls status; "Syncing 3/12 boards…", "Analysing 140 pins…" |
| `src/components/PinCard.tsx` | Pin image, owner avatar, Pinterest attribution link |
| `src/components/PinGrid.tsx` | Masonry grid of `PinCard` (CSS columns) |
| `src/components/SuggestionCard.tsx` | 4 representative pins, title, "Sam + you", room chip |
| `src/components/TasteOverlap.tsx` | Shared styles/colours/items chips + swatches |
| `src/components/RoomCard.tsx` | Room tile with photo + suggestion count |
| `src/components/ImageUploader.tsx` | Drop zone / camera input, client-side resize (`lib/client-image.ts`), Blob `upload()`, progress |
| `src/components/FloorplanEditor.tsx` | Image + SVG overlay of room boxes; drag/resize; side list of rooms |
| `src/components/RoomForm.tsx` | Name, type, size inputs |
| `src/components/RoomPhotoGallery.tsx` | Room photos with analysis badges |
| `src/components/MockupPicker.tsx` | Choose room photo (+ optionally deselect pins, max 6) → `createMockup` |
| `src/components/BeforeAfterSlider.tsx` | Draggable comparison (pointer events, keyboard accessible) |
| `src/components/ReactionButtons.tsx` | Thumbs up/down with counts |
| `src/components/JobStatusBadge.tsx` | queued/running/done/failed |
| `src/components/EmptyState.tsx` | Reusable empty states |
| `src/lib/client-image.ts` | (browser) resize to ≤ 2048 px with canvas, JPEG 0.85, strip EXIF |
| `src/hooks/usePropertyStatus.ts` | TanStack Query polling hook (2 s while anything is running, stops when idle) |

### 9.9 `tests/`

| File | Purpose |
|---|---|
| `tests/setup/msw.ts` | MSW server with default handlers |
| `tests/mocks/pinterest.ts` | Fake v5 endpoints (token, user_account, boards, pins with bookmarks, a 429) |
| `tests/mocks/anthropic.ts` | Fake Messages + Batches responses (from fixtures) |
| `tests/mocks/voyage.ts` | Deterministic fake embeddings |
| `tests/mocks/gemini.ts` | Returns a 1×1 PNG |
| `tests/fixtures/pins.json` | ~40 realistic pins across 2 members with known overlaps |
| `tests/fixtures/pin-analysis.json` | Matching tag results |
| `tests/fixtures/embeddings.json` | Hand-built vectors: known similar/dissimilar pairs |
| `tests/fixtures/floorplan.png`, `floorplan-result.json` | Sample floorplan + expected analysis |
| `tests/fixtures/room.jpg` | Sample room photo |
| `tests/helpers/db.ts` | Reset test DB, factories (`makeUser`, `makeProperty`, `makePin`…) |
| `tests/unit/crypto.test.ts` | Encrypt/decrypt round trip, tamper detection |
| `tests/unit/permissions.test.ts` | Role ordering |
| `tests/unit/pinterest-client.test.ts` | Pagination, 429 handling, response validation |
| `tests/unit/cluster.test.ts` | Components, split of oversized clusters, singletons |
| `tests/unit/score.test.ts` | Cross-member beats single-member; reactions move score |
| `tests/unit/assign-room.test.ts` | Majority vote, multiple bedrooms, no matching room |
| `tests/unit/overlap.test.ts` | Taste overlap counts |
| `tests/unit/ai-schemas.test.ts` | Fixtures parse; malformed output is rejected |
| `tests/integration/invites.test.ts` | Create/accept/expire/revoke; role enforced |
| `tests/integration/pinterest-sync.test.ts` | Full sync against MSW; removed pins marked; tokens refreshed |
| `tests/integration/suggestions.test.ts` | Fixtures → recompute → expected clusters/rooms, pgvector used |
| `tests/integration/disconnect.test.ts` | Data deleted, suggestions recomputed |
| `tests/integration/access-control.test.ts` | Non-members get 404 on every property action/route |
| `tests/e2e/onboarding.spec.ts` | Sign in → create property → invite link → second user joins |
| `tests/e2e/pinterest.spec.ts` | Connect (faked) → share boards → suggestions appear |
| `tests/e2e/floorplan.spec.ts` | Upload → edit a room box → confirm |
| `tests/e2e/mockup.spec.ts` | Room photo → pick suggestion → mock-up shows before/after |

---

## 10. Build order

Each phase is mergeable on its own and ends with its acceptance criteria passing in CI.

### Phase 0 — Skeleton (½ day)

- [ ] `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`), pnpm, `.nvmrc`, Prettier.
- [ ] `shadcn init` + the components in §9.8.
- [ ] Docker Compose with pgvector, Drizzle config, `0000_extensions.sql`, `src/lib/env.ts`.
- [ ] Vitest (both projects), Playwright, MSW setup, CI workflow.
- [ ] Deploy the empty app to Vercel with Neon attached.

**Done when:** `pnpm lint && pnpm typecheck && pnpm test` pass locally and in CI; the Vercel URL serves the landing page.

### Phase 1 — Google sign-in, properties, invites (2–3 days)

- [ ] Better Auth + Google, generated auth schema, `/sign-in`, `proxy.ts`, user menu with sign-out.
- [ ] Property schema, `/properties`, `/properties/new`, `/p/[id]` (empty home), `requireMember`.
- [ ] Members page, invite links, `/invite/[token]`, role changes, leave/remove.
- [ ] E2E sign-in bypass route.

**Done when:** you can sign in with Google on prod, create a property, send the invite link to a second Google account, and they land in the property as an editor; a third account without the link gets a 404 on the property URL; `onboarding.spec.ts` and `access-control.test.ts` pass.

### Phase 2 — Pinterest linking and sync (3–4 days)

- [ ] Pinterest OAuth routes, encrypted token storage, refresh.
- [ ] Inngest set up (local dev server + Vercel integration), `sync-pinterest`, `nightly-sync`.
- [ ] `/settings` connection card, `/p/[id]/boards` share toggles, `SyncStatus` polling.
- [ ] Disconnect deletes everything.
- [ ] **Apply for Pinterest Standard access** with a demo video of this phase.

**Done when:** linking your real Pinterest account lists your boards; sharing a board shows its pins in the property; "Sync now" picks up a pin you just saved; disconnect removes them; `pinterest-sync.test.ts` passes including the 429 and token-refresh cases.

### Phase 3 — Pin analysis and cross-referenced suggestions (4–5 days)

- [ ] Taxonomy, AI schemas, Anthropic client helper, pin-analysis prompt.
- [ ] `analyse-pins` with the Batches API; non-interior pins skipped.
- [ ] Voyage embeddings + HNSW index.
- [ ] `src/lib/suggestions/*` with unit tests first (fixtures with known answers), then `recompute-suggestions` job.
- [ ] Manual rooms (add/edit/delete) so suggestions have somewhere to go before Phase 4.
- [ ] Property home "Ideas for every room", taste-overlap panel, suggestion page, reactions.
- [ ] Tune `SIMILARITY_THRESHOLD` on real boards from two people (try 0.78–0.88; pick the value where clusters look like "the same idea" to a human).

**Done when:** with two members sharing real boards, the property home shows suggestions grouped by room, cross-member ones first, each with a sensible title and "You + Sam" attribution; a recipe board shared by mistake produces no suggestions; reacting 👎 drops a suggestion after the next recompute; `suggestions.test.ts` passes.

### Phase 4 — Floorplan analysis (2–3 days)

- [ ] Blob client uploads + `/api/uploads` with membership/role/type/size checks; `ImageUploader` with client resize.
- [ ] `analyse-floorplan` job, floorplan prompt and schema.
- [ ] `FloorplanEditor` (boxes, drag/resize, edit, add, delete) and Confirm.
- [ ] Recompute suggestions when rooms are confirmed.

**Done when:** uploading 3 different real estate-agent floorplans finds most labelled rooms with sensible types and sizes; you can fix the rest in under a minute; confirmed rooms replace the manual ones (or merge, with the user choosing); suggestions re-flow into the new rooms.

### Phase 5 — Room photos (1–2 days)

- [ ] Room photo uploads from the room page (camera on mobile), `analyse-room-photo`, wrong-room and quality warnings.

**Done when:** a kitchen photo uploaded to the kitchen is accepted; a blurry/dark photo asks for a retake; a bathroom photo uploaded to the bedroom warns.

### Phase 6 — Mock-ups (3–4 days)

- [ ] `MockupRenderer` interface + Gemini implementation; brief prompt + schema.
- [ ] `generate-mockup` job with concurrency limits, Blob storage, per-user queue limit.
- [ ] `MockupPicker`, mock-up page with `BeforeAfterSlider`, reactions, retry.
- [ ] Try 10 real room/suggestion pairs; tune the brief prompt until walls, windows and camera angle survive in ≥ 8/10.

**Done when:** from a room photo and a suggestion, a mock-up appears within ~1 minute showing *your* room restyled with the suggestion's pieces and palette; source pins are listed with Pinterest links; failures show a retry button and don't leave jobs stuck as `running`.

### Phase 7 — Hardening and launch (2–3 days)

- [ ] Sentry; structured logs in jobs (property id, job id, model, token usage, cost estimate).
- [ ] Per-user daily caps (mock-ups/day, analyses/day) from env.
- [ ] Account deletion (deletes Blob files too); privacy page explaining what is stored and how Pinterest data is used.
- [ ] Lighthouse/accessibility pass on mobile; empty/loading/error states on every page.
- [ ] README complete.

**Done when:** all E2E specs pass in CI; a new user can go from "Continue with Google" to their first mock-up on a phone without help.

**Rough total:** 3–4 weeks for one experienced engineer.

---

## 11. Running locally

```bash
pnpm install
cp .env.example .env        # fill in
pnpm db:up                  # Postgres+pgvector: dev :5432, test :5433
pnpm db:migrate
pnpm dev                    # http://localhost:3000
pnpm dev:jobs               # Inngest dev server at http://localhost:8288 (second terminal)
```

Pinterest needs `http://localhost:3000/api/pinterest/callback` registered on the app. Vercel Blob works from localhost with the token.

---

## 12. Cost estimate (per property, ballpark; check current pricing)

| Item | Unit cost (approx.) | Typical property |
|---|---|---|
| Pin tagging, Opus 5.5 via Batches (~1.5k input, ~300 output tokens) | ≈ $0.006 / pin | 1,000 pins ≈ $6 one-off; re-syncs only tag new pins |
| Embeddings (Voyage multimodal) | fractions of a cent / pin | < $0.50 |
| Floorplan analysis | ≈ $0.05–0.15 | 1–2 ≈ $0.30 |
| Room photo analysis | ≈ $0.02–0.05 | 10 ≈ $0.50 |
| Suggestion titles | ≈ $0.005 / cluster | 50 ≈ $0.25 |
| Mock-up (brief + image) | ≈ $0.05–0.25 depending on image model/resolution | 20 ≈ $1–5 |

So roughly **$10–15 per active property**, dominated by the first pin tagging. Haiku for tagging (§2.3) cuts that to ~$5. Hosting fits the free/hobby tiers of Vercel, Neon and Inngest until you have real users.

---

## 13. Risks and how this plan handles them

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Pinterest terms.** Pinterest restricts how API data is stored and used (e.g. no training ML models on it, deletion on disconnect, attribution). Generating images *inspired by* pins is a grey area. | Read the current guidelines before Phase 3. We never train on pins; we delete on disconnect; we always attribute and link back; mock-ups are private to the property's members and not shareable publicly in v1. Describe the mock-up feature plainly in the Standard-access application; if Pinterest objects, mock-ups can be driven by the *text* brief only (tags/palette), without sending pin images to the image model. |
| R2 | **Pinterest access level.** Trial access can't serve real users. | Apply for Standard access at the end of Phase 2; build Phases 3–6 using your own account meanwhile. |
| R3 | **Rate limits** during first sync of big accounts. | Inngest throttle + per-board steps + `Retry-After` sleeps; only shared boards' pins are analysed. |
| R4 | **Floorplan misreads.** | Draft-then-confirm editor (D8); never use unconfirmed rooms. |
| R5 | **Mock-ups distort the room.** | Strict brief with `keep` list; renderer interface allows switching models; users react and retry. |
| R6 | **AI cost runaway.** | Batches for tagging, analyse each pin once globally, per-user caps, Anthropic spend limit, logged cost per job. |
| R7 | **Privacy between members.** | Board sharing is opt-in per property (D4); only shared boards are visible to others; leaving/disconnecting removes data. |
| R8 | **Similarity threshold is wrong for real data.** | It's an env var; Phase 3 includes a tuning step on real boards; fixtures lock in the behaviour once chosen. |

---

## 14. Out of scope for v1 (good next steps)

- Email invites and notifications (Resend), comments on suggestions.
- Shopping: matching items to real products and prices.
- 3D/AR room scans (RoomPlan on iOS) instead of photos.
- Secret Pinterest boards; other sources (Instagram saves, Houzz, uploaded screenshots).
- Budget tracking and a "decided" board to hand to a builder.
- Native mobile app.
