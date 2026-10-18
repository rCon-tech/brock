# Hearth — Build Plan

> **Revision 4.** App-feature gaps filled (R27–R38): a details sheet for each card, "not quite, show me another" on compromise picks, per-item reactions and notes, a printable style brief, reminders and loose ends (solo board, start over, late joiners, removing people), offline-tolerant swiping, broken-image handling, budget totals, a first-run hint, rate limits, delete/export my data, and an explicit UK-only scope. Adds a v1.1 list (§19) and explicit non-goals (§20). About 5 days more engineering.
>
> **Revision 3.** Fixes the gaps in Revision 2: a weekend validation test before any code (§2); how people find the app (§4: solo style quiz, shareable boards, partner links, SEO pages); a revenue model that doesn't rely on affiliate links alone (§5); room context so suggestions fit real homes (R14–R16); together mode, both pass-the-phone and live reveal (R17–R18); a board that works with zero exact matches (R19); framing that never produces a winner and a loser (R20–R22); a personal style card for each person (R23); retention through the next room, a shopping list with "bought it" ticks and price-drop alerts (R24–R26); and a data flywheel that improves suggestions over time (§12).
>
> **Revision 2** replaced Revision 1 (Pinterest, floorplans, mock-ups) with the couples style-consensus MVP.

**Hearth** (working name) is a mobile-first web app that gets two (or up to four) people to agree on a room's style in under 5 minutes. Everyone swipes the same curated deck: about 12 whole-room photos (the vibe check), then about 18 products (sofas, rugs, lighting…), with 3 vetoes for deal-breakers. A synthesis engine turns the swipes into a shared board: exact matches, a named **bridge style** (e.g. *"Warm Industrial"*) with the evidence behind it, compromise pieces that fit the room you actually have, and buy links.

People can use it three ways:

- **Remote:** you start, then send a link or QR code. Your partner swipes on their own phone, no account needed.
- **Together, two phones:** both swipe at the same time and reveal the result together.
- **Together, one phone:** pass the phone; the app hides your choices between turns.

This document covers everything needed to validate and build the MVP: the validation test, the product rules, growth, revenue, the technology, accounts, the catalogue pipeline, the algorithms, the data flywheel, every file, the build order, metrics, costs and risks. No code exists yet. Each phase ends with acceptance criteria.

> This plan sits in the `brock` repo only because that's where it was written. Hearth is a separate app: start a new repo (e.g. `rcon-tech/hearth`) and copy this file in as its `PLAN.md`. It reuses the Brock stack (Next.js 16, Drizzle, Postgres, Vitest, Playwright, Vercel + Neon), and Brock's "no account until you need one" approach.

---

## 1. Product thesis and success metrics

- Inspiration tools (Pinterest, Instagram) produce endless boards but no decisions. Planning tools (Homestyler, Planner 5D) need spatial setup before you get to style. Style quizzes (e.g. Havenly's Style Shuffle) are single-user.
- Nobody **reconciles two people's tastes**. When A leans Industrial and B leans Minimalist, today's tools show zero overlap. Hearth finds the shared elements and proposes a bridge that fits the room they actually have.
- The second person is usually the less engaged one, so **partner B never needs an account** and is done in about 3 minutes.

The MVP succeeds if (measured in PostHog, §15):

| Metric | Target |
|---|---|
| Invited partners who finish swiping (remote mode) | ≥ 60% |
| Median time from partner B starting to the board being ready | ≤ 5 min |
| Boards rated "this helped us agree" | ≥ 60% 👍 |
| Boards with ≥ 1 buy click | ≥ 25% |
| Solo quiz takers who invite someone (§4.1) | ≥ 30% |
| Boards shared publicly (§4.2) | ≥ 10% |
| Projects that start a second room within 30 days (R24) | ≥ 15% |

---

## 2. Validate before building (Phase −1: one or two weekends, no code)

The riskiest question isn't technical. It's whether couples find a bridge board useful. Test that by hand first.

**Steps**

1. **Pick 30 cards by hand:** 12 living-room photos from Unsplash and 18 products from retailer sites, covering at least 8 styles. These become the first real catalogue items later.
2. **Make a form** (Google Forms or Tally): one page per card, "Yes / No", plus "Anything that's a hard no for you?" at the end. Each person fills it in separately, with their first name and a shared couple code.
3. **Recruit 10–15 couples** who are moving, renovating or moving in together: friends, friends of friends, local Facebook/WhatsApp groups, a post on r/HousingUK or similar. Offer a £10 voucher for a 15-minute follow-up call.
4. **Make each couple's board by hand** (about 30 min each): list double-yeses in a spreadsheet, ask Claude (in chat) to propose a bridge style and 8 compromise pieces from a product list you paste in, then lay it out as a one-page PDF or web page. Also note any "what's staying / pets / small room" comments they made.
5. **Follow-up call (15 min)**, same questions every time:
   - Did this help you agree? (1–5)
   - Did you learn anything about each other's taste?
   - Did either of you find it a chore?
   - Did you want the product links? Did you buy anything?
   - Would you pay for a version that shows these in a photo of your room? How much?
   - How would you have found an app like this?
6. **Talk to 3–5 businesses** (estate agents, letting agents, a new-build sales office, an interior designer): would they give this to clients? Would they pay, and how?
7. **Scan competitors** for an hour: App Store, Play Store, Product Hunt, "couples interior design swipe app". Note how anything similar differs.

**Go / no-go**

| Signal | Go if |
|---|---|
| "Helped us agree" score | ≥ 7 of 10 couples give 4 or 5 |
| Wanted product links | ≥ 5 of 10 asked for or clicked them |
| Partner found it a chore | ≤ 3 of 10 |
| A business wants to try it | ≥ 1 says yes to a pilot |

If the bridge board doesn't help, stop or change the idea before writing code. If it does, the form answers become **real-world test fixtures** for the engine (`tests/fixtures/concierge/`), and the calls tell you which acquisition channel (§4) to lead with.

---

## 3. Product rules (decide these first)

### Projects and people

| # | Rule | Default | Why |
|---|---|---|---|
| R1 | Project | **One room**: room type + optional name + optional budget band + room context (R14–R16). | "Resolve this room" |
| R2 | Who starts | **Anyone, as a guest.** Google sign-in is offered when it's useful: to get the "board ready" email, to save across devices, or for price alerts. | The solo quiz (§4.1) has to start with zero friction too |
| R3 | Who joins | Anyone with the link or QR, as a guest: type a first name and swipe. "Save with Google" later keeps their swipes. | No sign-up before value |
| R4 | Participants | 2 by default, up to **4**. All the maths is N-person. | Couples first, without hard-coding 2 |
| R5 | Invite link | Unguessable token, valid 14 days, until the project has 4 participants; revocable. Also shown as a QR code. | — |
| R6 | Room types at launch | **Living room, bedroom, dining room** | Furniture-led rooms swipe well; kitchens and bathrooms are mostly fixtures |

### Swiping

| # | Rule | Default | Why |
|---|---|---|---|
| R7 | Decks | **Macro**: 12 whole-room photos. **Micro**: 18 products across category quotas (§10.1). Everyone in a project gets the **same cards** in their own shuffled order. | Same cards make exact matches possible |
| R8 | Swipe | Right = yes, left = no, undo the last swipe. No "maybe". | Speed and a cleaner signal |
| R9 | Vetoes | **3 per person**. A veto is a hard no on a card, optionally with *why* by tapping one of its tags ("it's the velvet"). Vetoed items are never suggested; a vetoed attribute removes every item carrying it from compromise picks. | Deal-breakers |
| R10 | Privacy until reveal | Nobody sees anyone else's swipes until they've finished themselves. The board appears when everyone who joined has finished, or when someone presses "Show results now" (needs ≥ 2 finished). | Prevents anchoring |
| R11 | Tie-breaker round | Optional 8-card round of compromise picks after the board appears. Mutual yes moves an item into Agreed. Max 2 rounds. | Turns suggestions into agreement |
| R12 | Buying | Product links go through `/go/[itemId]` (logs the click, redirects to the affiliate link). Affiliate disclosure on every board, share page and email. | Revenue + UK ASA/CMA (and US FTC) rules |
| R13 | Budget band | Optional £ / ££ / £££ (thresholds per category in config); filters micro deck and compromise picks. | Stops "you both love a £6k sofa" |

### Room context (fixes "real rooms aren't empty")

Asked in a skippable 3-question step after choosing the room. Anyone in the project can edit it until the board is revealed. Each answer takes one tap.

| # | Rule | Default | How it's used |
|---|---|---|---|
| R14 | **What's staying** | Pick categories you're keeping (sofa, rug, dining table…) and optionally the colour and material of each from chips ("grey · fabric"). | Kept categories are **removed from the micro deck and compromise picks**, so the deck spends its cards on things you'll actually buy. Kept items' colours/materials become **anchors**: compromise items that go with them get a small boost and a "Goes with your grey sofa" badge, and the bridge rationale mentions them. |
| R15 | **Household** | Toggles: dog, cat, young kids. | Soft penalties on items tagged with practicality risks (§10.1: `delicate`, `light_fabric`, `loop_pile`, `glass_top`, `sharp_corners`), with a "may not suit pets/kids" badge and a "hide these" switch on the board. Never hard exclusions, because some people with dogs still want velvet. |
| R16 | **Tight spaces** | Optional maximum width per category, e.g. "sofa ≤ 200 cm", "rug ≤ 160 × 230". | Items with known dimensions over the limit are excluded. Items with unknown dimensions show "Check the size" rather than being excluded, since many feeds lack dimensions. |

### Together mode (fixes "they're sitting on the same sofa")

| # | Rule | Default | Why |
|---|---|---|---|
| R17 | **Pass the phone** | At project start, "How are you doing this?" → *Send a link* / *Together on our own phones* / *Together on this phone*. On one phone, each person types a name and swipes in turn; a full-screen **handoff screen** ("Pass to Sam, no peeking") hides the previous person's progress. Both people's swipes live in one browser session (R17 participants have no account of their own until one of them signs in). | Partner B doesn't even need to open a link |
| R18 | **Live reveal** | When everyone has finished (any mode), each person sees "Ready to see your board?". The board reveals with a short animated countdown on every phone once **all** have tapped Ready, or after anyone taps "Reveal now" 30 seconds later. Implemented with polling (2 s), no websockets. | The reveal is the fun part; doing it together makes it a moment |

### The board (fixes "zero matches" and "who won")

| # | Rule | Default | Why |
|---|---|---|---|
| R19 | **Board layout adapts** | **≥ 3 exact product matches:** lead with *Agreed*. **Fewer:** lead with the *bridge style* and **evidence**: for each shared element, the cards each person said yes to that contain it ("You both said yes to black metal: Rich ✓ these 2, Sam ✓ these 3"). The words "0 matches" never appear. Instead: "No exact matches, which is normal with 30 cards. Here's where your tastes meet." | Different tastes are the core use case, not a failure |
| R20 | **No scores, no winners** | The board never shows percentages, per-person fit scores or "X% compatible". Compromise picks show "Works for both of you". | Showing who compromised more makes the argument worse |
| R21 | **Everyone sees themselves in it** | The engine guarantees each person **brings at least one element** to the bridge (§11.3 step 6) and selects compromise picks so satisfaction is **balanced** between people (§11.3 step 7). The board's "What you each bring" section names one or two things per person. | Fairness that people can see |
| R22 | **Vetoes are anonymous on the board** | Shown as "Off the table: velvet, glass coffee tables", not attributed to a person. | Avoids blame |
| R23 | **Personal result for each person** | The moment you finish swiping, you see **your own** style card ("You lean Japandi, with a soft spot for brass") while you wait, without seeing your partner's swipes (R10 still holds). | Instant reward for the reluctant partner; also the hook for the solo quiz (§4.1) |

### After the board (fixes "used once, then forgotten")

| # | Rule | Default | Why |
|---|---|---|---|
| R24 | **Next room** | "Do the bedroom next" on the board creates a new project with the **same people already joined** and the household context copied. Half its macro deck is drawn from near the previous bridge style, half stays diverse (the same cards for everyone, as R7 requires). | A second session, and a smarter deck |
| R25 | **Shopping list** | Agreed and kept-for-later items form a shopping list. "Email us this list" sends it to every participant who has given an email; each link goes through `/go`. Tick "We bought this". | Couples buy weeks later, often on another device; an emailed list keeps those purchases on an affiliate link. "Bought it" also tells us how many purchases affiliate reports miss. |
| R26 | **Price-drop alerts** | Opt-in on the shopping list ("Tell us if anything drops in price"). Needs a signed-in email. Weekly digest at most; one-click unsubscribe. | Brings people back at the moment they're most likely to buy |

### Using the cards and the board

| # | Rule | Default | Why |
|---|---|---|---|
| R27 | **Card details** | Tap a card (or the ⓘ button) to open a bottom sheet. **Products:** up to 4 images (from the feed's extra images), price, retailer, stock, dimensions (or "Size not listed"), materials and colours from the tags. **Room photos:** full-screen zoom with attribution. You can swipe or veto from inside the sheet. Opening it pauses nothing and isn't recorded as a swipe. | People shouldn't say no to a sofa they'd like just because the thumbnail hid the price or size. It gives a cleaner signal. |
| R28 | **"Not quite, show me another"** | Every compromise pick has a swap button. It replaces the pick with the next-best item **in the same category** from the ranked list the engine already stored (§11.3 step 7), skipping anything shown, swapped or vetoed before. The swapped-out item counts as a soft no from whoever swapped it in future recomputes. Undo for 10 seconds. When a category runs out: "That's everything we have in rugs at this budget." | Fixes one bad pick without starting a tie-breaker round |
| R29 | **Reactions and notes** | On every board item, each person can react ❤️ Love / 🤔 Unsure / ✕ Not for us, and add one note of up to 140 characters ("love this but in green?"). Everyone's reactions and notes show on the item, with names, since this is the discussion layer. If everyone taps ❤️, the item joins the shopping list. If anyone taps ✕, it moves to a collapsed "Not for us" section (not deleted) and counts as a no in future recomputes. **No chat threads.** | Discussion happens next to the thing being discussed, without becoming a messaging app |
| R30 | **Style brief** | `/r/[id]/brief`: one printable page (print CSS) plus "Save as image" for phones. Contents: bridge name and tagline; palette as swatches with hex codes; materials, lines and mood; **Do** (shared elements) and **Avoid** (vetoed attributes and conflicts); agreed and loved pieces with photo, dimensions, price and retailer; room notes (what's staying, pets/kids, size limits); a QR code back to the live board. | The thing you show a decorator, a builder or a shop assistant |
| R31 | **Reminders and loose ends** | **Remind:** on the hub, "Send Sam a reminder" opens the phone's share sheet with a ready-made message and link (no push or SMS needed). **Solo board:** if your partner hasn't finished 3 days after joining or being invited, you can "See my board for now": the same board built from your swipes only, with a banner offering a reminder; it becomes the shared board when they finish. **Start over:** before the reveal, anyone can clear their own swipes and vetoes and redo the deck. **Late joiner:** someone joining after the reveal (up to 4 people) swipes the same deck; the board recomputes when they finish and everyone sees "Board updated: Alex joined". **Remove / leave:** the creator can remove a participant and anyone can leave; their swipes, vetoes and reactions are deleted and the board recomputes. | Real couples are messy; none of these should be dead ends |
| R32 | **Works on bad signal** | Swipes, undos and vetoes go into a queue on the phone (IndexedDB) with a client-generated id, and are sent in batches when the connection allows (also on reconnect and when the app comes back to the foreground). The deck and the next 6 images are prefetched, so swiping never waits on the network. A small "Saved, will sync" pill shows while offline. Only the reveal and the board need a connection. | People in a new home often have no wifi yet |
| R33 | **Broken images** | Nightly check (§10.4): any live item whose image fails twice in a row is retired. While swiping, if a card's image fails to load, the client reports it and quietly replaces the card from the project's **reserve cards** (2 per tier, chosen at project creation, the same for everyone). | Every image is hotlinked from someone else's server |
| R34 | **Budget totals** | The shopping list shows the total of in-stock agreed and loved items against the budget band's room total (config, e.g. £ up to £1,500, ££ up to £4,000, £££ above): "£1,840 of about £4,000". No budget band → total only. | Turns a mood board into a plan |
| R35 | **First-run hint** | On your first card ever: a short animated drag demo, plus "Tap for details". The first time you press Veto, an explanation of what vetoes do and how many you have. Shown once per person (stored on the user, with localStorage as a fallback for guests). Respects reduced motion. | Nobody has to guess how it works |
| R36 | **Rate limits** | Postgres-backed fixed windows (the Brock `rate-limit.ts` pattern): project creation 10/day per user and per IP; joins 20/hour per invite; swipes 120/minute per participant; `/go` 60/minute per IP; reactions/notes 60/minute per participant. Over the limit → a friendly "Slow down" message, never lost swipes (the offline queue retries). | Invite links are public by design |
| R37 | **Your data** | Settings (and a menu for guests): **Export my data** downloads JSON of your projects, swipes, vetoes, reactions and notes. **Delete my data** removes your account (or guest identity), participants, swipes, vetoes, reactions, notes, alerts and shopping ticks; boards you were on recompute for the others. Aggregates already counted in `item_stats` stay, as they contain nothing personal. | UK GDPR rights to access and erasure |
| R38 | **Market scope** | **UK only at launch:** £ (GBP), centimetres, UK retailers, en-GB copy. Currency, units and locale live in one file (`src/lib/locale.ts`) so other markets are a config change plus a catalogue, not a rewrite. | Keeps the catalogue and affiliate work focused |

---

## 4. Growth: how Partner A finds Hearth

### 4.1 Solo style quiz (main top-of-funnel)

`/quiz`: "What's your living room style? 30 swipes, 3 minutes." It's the same project and swipe flow with one participant. The ending is the personal style card (R23) plus one clear next step: **"Now find out how your style fits with your partner's"** → the invite panel. Single-user style quizzes are already what people search for and share; Hearth's twist is the second step.

- Shareable personal result image (`/r/[id]/me/opengraph-image.tsx`): style name, palette swatches, three product thumbnails.
- Copy is written for the partner receiving the link: "Rich took the style quiz and wants to know how your tastes compare. 3 minutes, no sign-up."

### 4.2 Shareable boards

"Share our board" creates a public read-only page `/s/[shareId]`: bridge name, tagline, palette, agreed and compromise products (with disclosure), and **no** swipes, vetoes or (by default) names. Its Open Graph image (built with `next/og`) is designed to look good in WhatsApp and Instagram stories. The page's call to action: "Find your shared style". Share links can be revoked.

> Share images use palette swatches and **product** images (check each affiliate programme's creative-use terms), not Unsplash photos, because Unsplash's API terms require hotlinking their URLs rather than re-hosting the images in generated graphics.

### 4.3 Partner links (estate agents, developers, designers)

Each partner gets a co-branded landing page `/with/[partnerSlug]` ("A moving-in gift from Smith & Co") and a tracked link. Projects started from it carry `ref_partner`, and partners get a monthly usage report (admin page). Phase −1 conversations decide which partner type to approach first. Start with 2–3 local pilots; no revenue share in the MVP, just usage numbers to make the case later (§5).

### 4.4 SEO pages (slow but compounding)

- `/styles/[style]`: what the style is, example rooms (hotlinked Unsplash), products from the catalogue, "Take the quiz".
- `/combine/[pair]` for the ~60 most common style pairs, e.g. "Industrial + Minimalist: how to combine them". Content is computed from the engine itself (the maximin bridge between the two style centroids, the shared attributes, compromise products), with the wording drafted by Claude **offline and reviewed by you before publishing**. These match how people actually search when they disagree.
- `sitemap.ts` lists them all.

### 4.5 Loops already inside the product

Every partner B is a potential A for their friends; every board offers "Next room" (R24); the share page and the personal result are both entry points.

---

## 5. Revenue

Affiliate commission alone is thin: homeware commissions are often single-digit percentages, purchases happen weeks later, and many are made in shops. So the MVP **tests four revenue lines at once**, cheaply, and the launch data decides which one to build properly.

| Line | MVP version | What it tells you |
|---|---|---|
| **1. Affiliate** | `/go` links + emailed shopping list (R25) + price-drop alerts (R26) + "Bought it" ticks | Real revenue per board, and how much attribution leaks (bought-it ticks vs affiliate-reported sales) |
| **2. Paid "See it in your room"** | **Fake door**: a button on the board, "See this in a photo of your room, £4.99". Tapping it explains it's coming soon, charges nothing, and offers a waitlist. | Willingness to pay for the v2 mock-up feature (§19), which is also the costliest feature to run, so it should be paid |
| **3. Designers (B2B)** | `/designers` page: "Run Hearth with your clients, branded" + interest form (practice size, clients/month, what they'd pay). | Whether a subscription business exists |
| **4. Partners (B2B2C)** | Partner links (§4.3) with usage reports | Whether estate agents/developers will pay for a branded moving-in gift |

Rules: fake doors always say plainly that the feature isn't available yet, and never take payment details. **Commercial terms never affect ranking**: no paid placement, and a retailer's commission rate is used only to decide which retailers to curate, never to rank items. Trust is the product.

Unit economics (illustrative; replace every number with real ones from Phase −1 and your programme terms):

```
revenue per finished board ≈ P(buy click) × P(purchase | click, attributed) × average order × commission
                           ≈ 0.25         × 0.15                            × £350          × 5%   ≈ £0.66
```

Costs per board are about $0.01 (§17), so affiliate revenue is profitable per user but small. The fake doors and B2B interest decide where the real business is.

---

## 6. Technology (every piece)

### 6.1 App

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Language | TypeScript | 5.9 | Everything |
| Runtime | Node.js | 24 (`.nvmrc`), engines `>=22` | Server, scripts |
| Package manager | pnpm | 10 | — |
| Framework | Next.js (App Router) | 16 | Pages, Server Actions, route handlers, `after()`, `proxy.ts`, `next/og` image generation, `sitemap.ts` |
| UI | React | 19 | — |
| Styling | Tailwind CSS | 4 | — |
| Components | shadcn/ui (Radix primitives, copied into `src/components/ui`) | latest CLI | — |
| Icons | lucide-react | latest | — |
| Swipe physics | **motion** (formerly Framer Motion) + **@use-gesture/react** | 12 / 10 | Drag, fling, card stack, reveal countdown |
| Client data | TanStack Query | 5 | Polling project state, optimistic swipes |
| Offline queue | `idb-keyval` (IndexedDB) | 6 | Swipe queue and prefetched deck (R32) |
| Validation | Zod | 4 | Inputs, env, AI output, feed rows |
| QR codes | `qrcode` | 1.5 | Invite QR as SVG |

### 6.2 Data, auth, email, analytics

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Database | PostgreSQL + **pgvector** | Postgres 16, pgvector 0.8 | All data, catalogue embeddings, style centroids |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45 / 0.31 | — |
| Driver | postgres.js | 3 | — |
| Auth | **Better Auth**: Google provider + **anonymous plugin** + Drizzle adapter | 1.x | Guests by default, Google when useful, guest → Google linking keeps data |
| Email | **Resend** + React Email | latest | Board ready, shopping list, price-drop digest (with unsubscribe) |
| Product analytics | **PostHog** (cookieless until consent) | latest | Funnels, fake-door clicks |
| Errors | Sentry (`@sentry/nextjs`) | latest | — |
| Scheduled jobs | **Vercel Cron** → route handlers | — | Feed refresh, price alerts, item stats, image checks |

No job queue: deck building and synthesis are fast in-process maths over pre-computed embeddings. The only live AI call (naming the bridge) runs in `after()`, and the board polls until it's there.

### 6.3 Catalogue sources and AI

| Job | Service | Detail | When |
|---|---|---|---|
| Whole-room photos | **Unsplash API** (Pexels as a second source) | Licence allows use and modification; API terms require hotlinking, attribution and pinging `download_location` when a photo is shown | Import script; production approval before launch |
| Products | **Awin** product feeds (add Rakuten/Impact/CJ for other retailers or regions) | Title, image, description, price, stock, affiliate deep link | Import + nightly refresh |
| Ad-hoc products | **Skimlinks** (optional) | Affiliate links for any retailer URL | Admin |
| Tagging catalogue items | **Claude API** (`@anthropic-ai/sdk`) via **Message Batches** | `claude-opus-5-5`, effort `low`, structured output: style weights, materials, colours, lines, finishes, mood, **practicality risks**, **dimensions parsed from the description**, category, room types, quality flags | Offline, once per item |
| Image embeddings | **Voyage AI** multimodal (`voyageai`) | `voyage-multimodal-3` (1024-d; use the newest multimodal model when you start) | Offline, once per item; text search in admin |
| Naming the bridge | Claude API | `claude-opus-5-5`, effort `low`, structured output, server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) | Live, once per board version |
| SEO pair pages | Claude API | `claude-opus-5-5`, effort `medium`, structured output; **human review before publish** | Offline |

> **Why Voyage, not raw CLIP:** everything is embedded offline, so either works. Voyage keeps the stack in TypeScript and embeds text in the same space (admin search for "brass floor lamp"). An open SigLIP/CLIP model in a one-off Python script is a drop-in swap; keep the dimension in one constant.

### 6.4 Quality and delivery

| Layer | Choice | Purpose |
|---|---|---|
| Unit + integration | Vitest 3 (`unit`, `integration`) | Algorithms, DB |
| HTTP mocking | MSW 2 | Fake Anthropic, Voyage, Unsplash, Resend |
| IndexedDB in tests | `fake-indexeddb` | Unit-testing the offline swipe queue |
| E2E | Playwright (multiple browser contexts = multiple partners) | Full flows |
| Lint / format / types | ESLint 9, Prettier 3, `tsc --noEmit` | — |
| CI | GitHub Actions (Postgres + pgvector service) | — |
| Scripts | `tsx` | Catalogue, stats and SEO scripts |
| Feed parsing | `csv-parse` | Awin feeds |
| Local DB | Docker Compose, `pgvector/pgvector:pg16` | Dev :5432, test :5433 |
| Hosting | Vercel (app + Cron) + Neon Postgres | — |

---

## 7. Accounts and keys (Day 0)

Start approvals first; Unsplash and the affiliate programmes have lead time.

1. **Google Cloud** → Google Auth Platform → consent screen (External) → Web OAuth client. Redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://<domain>/api/auth/callback/google`. Scopes `openid email profile`.
2. **Unsplash** developers → new app (demo mode) → apply for production once attribution shows correctly.
3. **Awin** → publisher sign-up → apply to homeware retailers' programmes (manual; some want a live site, so ship the landing page in Phase 0) → product-feed URLs.
4. **Anthropic** → API key, monthly spend limit.
5. **Voyage AI** → API key.
6. **Resend** → API key, verify the sending domain.
7. **PostHog** → project (EU cloud if UK/EU-based).
8. **Neon** → database `hearth` → `CREATE EXTENSION IF NOT EXISTS vector;`.
9. **Vercel** → import repo, env vars, crons (`vercel.ts`).
10. **Sentry** → DSN.
11. Secrets: `openssl rand -base64 32` for `BETTER_AUTH_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`.

### Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | App DB, test DB |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `ANTHROPIC_API_KEY` | Tagging, bridge naming, SEO drafts |
| `VOYAGE_API_KEY` | Embeddings |
| `UNSPLASH_ACCESS_KEY` | Photo import + download pings |
| `AWIN_FEED_URLS` | Comma-separated feed URLs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `UNSUBSCRIBE_SECRET` | Signs one-click unsubscribe links |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics |
| `SENTRY_DSN` | Errors |
| `CRON_SECRET` | Vercel Cron bearer token |
| `ADMIN_EMAILS` | Google emails allowed into `/admin` |
| `E2E_TEST_AUTH` | `1` only in E2E; enables `/api/test/sign-in` (refused in production) |

---

## 8. Architecture

```
            ┌──────────── OFFLINE (scripts) ───────────────────────────┐
 Unsplash ─►│ import-photos ─┐                                          │
 Awin    ──►│ import-feed  ──┼─► catalogue_item (draft)                 │
            │                ├─► tag-catalogue (Claude Batches)         │
            │                ├─► embed-catalogue (Voyage)               │
            │                ├─► build-style-centroids                  │
            │                └─► generate-pair-pages (Claude → review)  │
            │ /admin/catalogue review → live                            │
            └───────────────────────────────────────────────────────────┘
                                   │ Postgres + pgvector
            ┌──────────── ONLINE (Next.js on Vercel) ───────────────────┐
 /quiz, /, /with/[partner], /styles, /combine, /s/[share]  (entry points)
   └─► create project (guest) ─► room context ─► mode: link | 2 phones | 1 phone
         ─► deck builder (pure TS, uses item_stats) ─► swipe ─► personal result
         ─► all finished ─► Ready? ─► synthesis (pure TS, ms) ─► reveal
         ─► after(): Claude names bridge ─► board ─► tie-breaker ─► share
         ─► shopping list / bought it / alerts / next room / fake doors
 Vercel Cron: 03:17 feeds refresh · 04:17 price alerts · 05:17 item stats · 06:17 image checks
```

Rules of the road:

- **All per-user maths is deterministic TypeScript** in `src/lib/engine/`, unit-tested with synthetic and real (Phase −1) data. AI only (a) understands the catalogue offline and (b) names and explains a result the maths already chose. A failed AI call costs only the wording.
- **Every project action calls `requireParticipant(projectId, participantId?)`.** Guests are anonymous Better Auth users. In pass-the-phone mode one session controls several participants, and the check confirms the session is their host.
- Swipes are idempotent upserts keyed by a client-generated id, so a closed tab, a retry or an offline batch (R32) never loses or duplicates anything. Offline swipes are sent to a batch route handler (`/api/swipes`), not a Server Action, so the queue can retry them without a rendered page.

---

## 9. Data model

Ids are app-generated `text` except Better Auth's tables. All tables have `created_at`.

### 9.1 Auth (Better Auth CLI)

`user` (…, `is_anonymous`), `session`, `account`, `verification`.

### 9.2 Catalogue and stats

| Table | Columns | Notes |
|---|---|---|
| `retailer` | id, name, network `awin|skimlinks|manual`, commission_note, cookie_days | Used for curation decisions only, never ranking |
| `catalogue_item` | id, tier `macro|micro`, room_types text[], category, title, description, image_url, image_w, image_h, source, source_id, attribution_name, attribution_url, unsplash_download_location, retailer_id, price_pence, currency, product_url, affiliate_url, in_stock, **width_cm, depth_cm, height_cm** (nullable), extra_images text[] (R27), image_failures int, image_checked_at, status `draft|live|retired`, tags jsonb, primary_style, style_weights jsonb, embedding `vector(1024)`, tagged_at, embedded_at, last_seen_in_feed_at | Unique (source, source_id); HNSW on embedding; GIN on room_types |
| `style` | slug, name, description, centroid `vector(1024)`, item_count | ~25 rows |
| `style_pair_page` | pair_slug (e.g. `industrial--minimalist`), bridge_style, shared_attributes jsonb, item_ids text[], title, intro, body, status `draft|published`, reviewed_at | SEO pages (§4.4) |
| `item_stats` | item_id, exposures, rights, tiebreak_shown, tiebreak_mutual_yes, clicks, bought, updated_at | Nightly aggregate (§12) |

### 9.3 Projects, people, swipes

| Table | Columns | Notes |
|---|---|---|
| `project` | id, room_type, name, budget_band, context jsonb (§9.4), mode `remote|together_devices|together_one_device`, created_by → user, previous_project_id (nullable), ref_partner (nullable), macro_deck text[], micro_deck text[], reserve_macro text[], reserve_micro text[] (R33), deck_seed, revealed_at | Decks and reserves frozen at creation |
| `project_invite` | id, project_id, token_hash, expires_at, revoked_at | |
| `participant` | id, project_id, user_id (nullable for pass-the-phone participants), host_user_id (the session that controls them), display_name, role `creator|partner`, joined_at, macro_done_at, micro_done_at, ready_at, joined_after_reveal bool, last_reminded_at, vetoes_left (3), email (nullable, for shopping list/alerts) | Unique (project_id, user_id) where user_id not null; max 4 per project. Removing or leaving deletes the row and cascades (R31). |
| `swipe` | participant_id, item_id, round `macro|micro|bridge`, value (−1/1), client_id (uuid, unique), decision_ms, position, created_at, updated_at | PK (participant_id, item_id, round); `client_id` makes offline retries idempotent (R32) |
| `item_reaction` | project_id, item_id, participant_id, reaction `love|unsure|no`, note (≤ 140 chars, nullable), updated_at | PK (project_id, item_id, participant_id) (R29) |
| `pick_swap` | id, project_id, synthesis_version, category, from_item_id, to_item_id, by_participant_id, undone_at | R28; from_item becomes a soft no for by_participant |
| `rate_limit` | key, window_start, count | R36 |
| `veto` | id, participant_id, item_id, attribute (nullable) | |
| `bridge_round` | id, project_id, synthesis_version, item_ids text[] | Max 2 |

### 9.4 `project.context` shape

```ts
{
  keeping: { category: Category; colour?: Colour; material?: Material }[];
  household: { dog: boolean; cat: boolean; youngKids: boolean };
  maxSize: { category: Category; widthCm?: number; depthCm?: number }[];
  hidePracticalRisks: boolean; // the board's "hide these" switch
}
```

### 9.5 Board, sharing, retention, revenue

| Table | Columns | Notes |
|---|---|---|
| `synthesis` | project_id, version, inputs_hash, status `computing|ready`, result jsonb (§11.3 output), bridge_name, tagline, rationale, contributions jsonb, ai_model, computed_at | Latest version shown |
| `board_feedback` | project_id, participant_id, helpful bool | |
| `share_link` | id, project_id, created_by, show_names bool, revoked_at | Public `/s/[id]` |
| `shopping_list_item` | project_id, item_id, source `agreed|tiebreak|loved|saved`, bought_at (nullable), bought_by_participant_id | R25 |
| `price_alert` | id, user_id, project_id, item_id, baseline_price_pence, last_notified_at, unsubscribed_at | R26 |
| `outbound_click` | id, item_id, project_id, participant_id, surface `board|share|email|seo`, created_at | |
| `referral_partner` | slug, name, logo_url, contact_email, active | §4.3 |
| `waitlist` | id, email, feature `see_in_room|designers`, project_id (nullable), details jsonb | Fake doors (§5) |

Also on Better Auth's `user` (additional fields): `hint_seen_at` (R35).

---

## 10. Catalogue pipeline (offline)

### 10.1 Taxonomy (`src/lib/taxonomy.ts`)

- **Room types:** living_room, bedroom, dining_room (others reserved).
- **Styles (~25):** industrial, minimalist, japandi, scandinavian, mid_century, modern_farmhouse, coastal, boho, traditional, art_deco, maximalist, rustic, contemporary, mediterranean, wabi_sabi, hollywood_regency, french_country, transitional, organic_modern, eclectic, cottagecore, warm_minimal, brutalist, shaker, retro_70s.
- **Attribute families:**
  - `material`: oak, walnut, dark_wood, light_wood, rattan, cane, marble, travertine, concrete, linen, boucle, velvet, leather, wool, jute, metal_black, brass, chrome, glass, ceramic
  - `colour`: white, cream, beige, greige, grey, charcoal, black, sage, olive, terracotta, rust, navy, blush, mustard, multicolour
  - `line`: clean_lines, curved, chunky, slim_legs, tufted, rounded_edges, geometric, ornate
  - `finish`: matte, gloss, distressed, natural, lacquered
  - `mood`: airy, cosy, dramatic, calm, playful, earthy
  - `practical` (risks, R15): delicate, light_fabric, loop_pile, glass_top, sharp_corners, high_maintenance
- **Household rules** (`src/lib/engine/household.ts`): dog/cat → penalise `delicate`, `light_fabric`, `loop_pile`, `high_maintenance`; young kids → penalise `glass_top`, `sharp_corners`, `delicate`, `light_fabric`.
- **Colour harmony** (`src/lib/engine/harmony.ts`): a small hand-written table of which colours/materials sit well with each anchor (e.g. grey → charcoal, white, sage, navy, light_wood, black). Used for R14 boosts.
- **Micro category quotas** (living room): sofa 3, armchair 2, coffee_table 2, rug 3, ceiling_light 1, floor_lamp 1, table_lamp 1, storage 2, side_table 1, decor 2. Kept categories (R14) have their quota redistributed to the remaining categories.

### 10.2 Scripts

| Script | Does |
|---|---|
| `scripts/import-photos.ts --room living_room --query "living room interior" --pages 10` | Unsplash search → draft macro items with attribution; keeps portrait 4:5–3:4, ≥ 1600 px |
| `scripts/import-feed.ts` | Downloads Awin feeds → Zod-validated rows → draft micro items (category from `category-map.ts`; unmapped rows counted and skipped) |
| `scripts/tag-catalogue.ts` | Untagged items → Claude Batches (image + title + description) → `ItemTagsSchema` (styles, attributes, practical risks, dimensions if stated, flags) → write; retires items flagged `not_a_room`, `watermark`, `cluttered`, `poor_cutout` |
| `scripts/embed-catalogue.ts` | Unembedded items → Voyage (image + "{title}. {primary_style}. {top tags}") |
| `scripts/build-style-centroids.ts` | Weighted mean of live items per style; warns on < 15 items |
| `scripts/generate-pair-pages.ts` | For the ~60 most common style pairs (from `item_stats` once there's traffic, a hand list before): compute bridge + shared attributes + items with the engine, ask Claude for title/intro/body → `style_pair_page` drafts for review in admin |
| `scripts/import-concierge.ts` | Turns Phase −1 form exports into `tests/fixtures/concierge/*.json` (real swipes against real items) |
| `scripts/seed-dev.ts` | Fixture catalogue with synthetic vectors; no API keys needed |

**Launch catalogue target:** per room type ≈ 150 live photos and ≈ 400 live products, spread across styles (the admin coverage grid shows gaps), with dimensions known for ≥ 50% of sofas, rugs and tables.

### 10.3 Admin (`/admin`)

- `/admin/catalogue`: review drafts, edit tags/dimensions, approve, retire, bulk; coverage grid; text search via Voyage.
- `/admin/pages`: review and publish `style_pair_page` drafts.
- `/admin/partners`: create partner links, see usage per partner.
- `/admin/metrics`: DB-backed counts (funnel, clicks vs bought-it, fake-door sign-ups) as a PostHog backup.

### 10.4 Nightly jobs (Vercel Cron)

- `refresh-feeds` (03:17 UTC): price, stock, affiliate URL by (source, source_id); retire after 3 missing nights; out-of-stock items leave decks and picks but stay on existing boards marked "Out of stock".
- `price-alerts` (04:17 UTC): price drops ≥ 10% from baseline on alerted items → one digest per user per week at most.
- `item-stats` (05:17 UTC): recompute `item_stats` (§12).
- `check-images` (06:17 UTC): `HEAD` request (falling back to a ranged `GET`) for every live item's image, 10 at a time; increment `image_failures` on failure, reset on success; retire at 2 (R33). Client-reported failures (`/api/report-image`) bump the same counter.

---

## 11. The engine (pure TypeScript, `src/lib/engine/`)

Notation: `e(i)` is item i's normalised embedding; `P` the participants; `L_p`, `D_p` the items p swiped right/left on (macro weighted ×1.5).

### 11.1 Deck building (at project creation)

- **Context first:** drop kept categories (R14) and redistribute their quota; apply budget band (R13) and size limits (R16) to the micro pool.
- **Informative cards only:** skip items whose `item_stats` show ≥ 50 exposures and a right-rate above 0.9 or below 0.1 (everyone agrees, so they tell us nothing).
- **Macro (12):** farthest-point sampling over embeddings from a seeded start, covering ≥ 8 primary styles. For a next-room project (R24): 6 by farthest-point sampling + 6 nearest the previous bridge centroid.
- **Micro (18):** per category quota, farthest-point sampling within the category.
- **Reserves (R33):** 2 extra per tier, chosen the same way and kept back to replace cards whose image fails.
- Same cards for everyone, each in their own seeded shuffle.

### 11.2 Taste profile per person (also drives the personal result, R23)

- Taste vector `t_p = normalise( mean_w(e(L_p)) − 0.5 · mean_w(e(D_p)) )`.
- Attribute affinity `aff_p(a) = (k + 1)/(n + 2) − 0.5` over n exposures and k right swipes; ignored when n < 2.
- Top 3 styles by `cos(t_p, centroid_s)`; the top 2 positive attributes → "You lean Japandi, with a soft spot for brass".
- Confidence: share of macro swipes consistent with the top style. Low confidence makes the board suggest the tie-breaker more strongly.

### 11.3 Synthesis

1. **Exact matches:** items every participant swiped right on, minus vetoes and kept categories.
2. **Shared elements:** attributes with `aff_p(a) ≥ 0.2` for every p, ranked by the smallest affinity.
3. **Conflicts:** one person ≥ 0.2 and another ≤ −0.2.
4. **Evidence (R19):** for each shared element, the cards each person liked that carry it (up to 3 each).
5. **Bridge style (maximin):** `argmax_s min_p cos(t_p, centroid_s)`. If everyone's own top style is the same, "You already agree".
6. **Everyone brings something (R21):** for each person, their highest-affinity attribute that is (a) not in conflicts and (b) present in the candidate pool. If no compromise pick will carry it, reserve one pick slot for the best-scoring item that does.
7. **Compromise picks:** candidates = live, in-stock, in-budget, size-fitting micro items for the room type (whole catalogue), excluding vetoed items, items with vetoed attributes, items anyone swiped left on, and kept categories. Prefilter with pgvector (300 nearest the mean taste vector). Score per person:
   `s_p(i) = cos(e(i), t_p) + 0.3 · mean_{a ∈ tags(i)} aff_p(a)`
   then
   `base(i) = min_p s_p(i) + 0.1 · anchor_match(i) − 0.15 · household_risk(i) + 0.15 · (mutual_yes_rate(i) − global_rate)`
   (anchor_match from R14 harmony, household_risk from R15, mutual_yes_rate from `item_stats`, smoothed). If `hidePracticalRisks` is on, risky items are excluded instead of penalised.
   **Balanced greedy selection** of 12: at each step pick the item maximising `min_p (cumulative_p + s_p(i))`, combined with MMR diversity (λ = 0.7) and at most 2 per category, after placing the reserved R21 items. This keeps total satisfaction even between people instead of letting one person's favourites dominate.
   **Swap queue (R28):** also store the next 10 ranked candidates per category in `result.swapQueue`, so "show me another" is an instant lookup with no recompute.
   **Board feedback as input:** ✕ reactions (R29) and swapped-out items (R28) count as left swipes for the person who made them; ❤️ reactions count as right swipes. They feed the next recompute.
8. **Hybrid rooms:** top 4 macro photos by the same maximin score.
9. **Layout decision (R19):** `lead = exactMicroMatches ≥ 3 ? "agreed" : "bridge"`.
10. Persist with `status = computing`, respond, then in `after()`:
11. **Name it (Claude):** input = names, each person's top styles, the bridge style, shared elements, conflicts, each person's "brings" attributes (step 6), kept items, household flags, and the picks' tags. Output (`BridgeNameSchema`): `{ name (≤ 3 words from the taxonomy vocabulary), tagline (≤ 12 words), rationale (≤ 60 words, mentions kept items if any), contributions: [{ participant, brings (≤ 15 words, positive framing, no comparison) }] }`. Prompt rules: no scores, no "won", no "compromised more", no blame. Validated; fallback to the taxonomy name and template sentences. Then `status = ready`.

All steps except 11 take milliseconds. `inputs_hash` skips recomputing when nothing changed.

**When it recomputes:** reveal; after each tie-breaker; when a late joiner finishes or someone is removed or leaves (R31); and on the next board visit after reactions or swaps changed the inputs.

**Solo board (R31):** with one finished participant the same code runs with N = 1. Maximin reduces to that person's own preferences: the bridge becomes their top style, there are no conflicts or "what you each bring", and the board says "Your board for now" with a reminder banner. No special-case engine code, just a different layout.

### 11.4 Tie-breaker

8 cards: the top compromise picks nobody has swiped. Mutual yes → Agreed + shopping list. Re-run synthesis (version + 1). Max 2 rounds.

### 11.5 Regression fixtures

- `industrial-vs-minimalist.json` (synthetic): no exact matches → lead = bridge; shared elements include `clean_lines` and `metal_black`; bridge = `warm_minimal` (whose centroid sits between them); every pick works for both (`s_p ≥ 0.4`); each person has ≥ 1 "brings" attribute; satisfaction gap between the two ≤ 0.1.
- `keeping-grey-sofa.json`: no sofas in deck or picks; ≥ 3 picks badged "Goes with your grey sofa".
- `dog-household.json`: no `light_fabric` boucle in the top 6 picks; hidden entirely when the switch is on.
- `concierge/*.json` (real Phase −1 data): the engine's bridge matches the one you made by hand, or the difference is explainable; this becomes the eval set when tuning weights.

---

## 12. Data flywheel

Every project produces labelled data no competitor has: which cards people with different tastes **both** accept.

| Signal | Collected from | Used for |
|---|---|---|
| Right-rate per item | `swipe` | Dropping uninformative cards from decks (§11.1) |
| Tie-breaker mutual-yes rate | `swipe` round `bridge` | A learned "works for couples" boost in compromise scoring (§11.3 step 7) |
| Clicks, bought-it | `outbound_click`, `shopping_list_item` | Spotting great bridge items; measuring affiliate leakage |
| Helpful 👍/👎 per board | `board_feedback` | Tuning the weights (0.3, 0.1, 0.15) against the concierge + real boards |
| Most common style pairs | `synthesis` | Which `/combine/[pair]` SEO pages to write first |

Computed nightly into `item_stats` (cheap SQL aggregates, all smoothed with priors so new items aren't punished). Only aggregates are used; the privacy page says so. A trained ranking model is a later step once there are thousands of boards.

---

## 13. Every file

✱ = generated by a tool.

### 13.1 Root

| File | Purpose |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `vercel-build` (migrate on prod, then build), `lint`, `format`, `typecheck`, `db:up`, `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `catalogue:photos`, `catalogue:feed`, `catalogue:tag`, `catalogue:embed`, `catalogue:centroids`, `pages:generate`, `concierge:import`, `test`, `test:integration`, `test:e2e` |
| `pnpm-lock.yaml` ✱ | — |
| `.nvmrc` | `24` |
| `.env.example` | §7 vars |
| `.gitignore`, `.prettierrc`, `.prettierignore` | — |
| `eslint.config.mjs` | — |
| `tsconfig.json` | Strict, `@/*` → `src/*` |
| `next.config.ts` | `images.remotePatterns` (Unsplash, feed hosts); Sentry |
| `vercel.ts` | Four crons (§10.4) |
| `postcss.config.mjs`, `components.json`, `drizzle.config.ts` | — |
| `docker-compose.yml` | pgvector dev + test |
| `vitest.config.ts`, `playwright.config.ts` | — |
| `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts` | Sentry |
| `README.md` | Setup, catalogue pipeline, crons, testing, deploying |
| `PLAN.md` | This file |

### 13.2 CI and migrations

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | lint + typecheck + unit; integration; e2e |
| `.github/pull_request_template.md` | — |
| `drizzle/0000_extensions.sql` | `CREATE EXTENSION IF NOT EXISTS vector;` |
| `drizzle/0001_init.sql` ✱ | All tables (§9) |
| `drizzle/0002_indexes.sql` | HNSW, GIN, partial live/in-stock index |
| `drizzle/meta/*` ✱ | — |

### 13.3 `src/db/`

| File | Purpose |
|---|---|
| `src/db/index.ts` | Client + `drizzle()` |
| `src/db/schema/auth.ts` ✱ | Better Auth |
| `src/db/schema/catalogue.ts` | `retailer`, `catalogue_item`, `style`, `style_pair_page`, `item_stats` |
| `src/db/schema/projects.ts` | `project`, `project_invite`, `participant` |
| `src/db/schema/swipes.ts` | `swipe`, `veto`, `bridge_round` |
| `src/db/schema/board.ts` | `synthesis`, `board_feedback`, `share_link`, `item_reaction`, `pick_swap` |
| `src/db/schema/ops.ts` | `rate_limit` |
| `src/db/schema/commerce.ts` | `shopping_list_item`, `price_alert`, `outbound_click` |
| `src/db/schema/growth.ts` | `referral_partner`, `waitlist` |
| `src/db/schema/index.ts` | Re-exports |

### 13.4 `src/lib/`: server logic

| File | Purpose |
|---|---|
| `src/lib/env.ts` | Zod env |
| `src/lib/ids.ts`, `src/lib/errors.ts`, `src/lib/crypto.ts` | Ids, errors, tokens/hashes/HMAC for unsubscribe |
| `src/lib/auth.ts` | Better Auth (Google + anonymous with `onLinkAccount` moving participants, alerts and shopping ticks to the Google user) |
| `src/lib/auth-client.ts` | Browser client |
| `src/lib/session.ts` | `getSession`, `requireSession`, `requireAdmin` |
| `src/lib/permissions.ts` | `requireParticipant(projectId, participantId?)` incl. host check for pass-the-phone |
| `src/lib/taxonomy.ts` | §10.1 + Zod enums |
| `src/lib/budget.ts` | Budget bands |
| `src/lib/context.ts` | Validate/update `project.context` (R14–R16) |
| `src/lib/projects.ts` | Create (incl. solo quiz and next room), list, rename, delete |
| `src/lib/invites.ts` | Create, revoke, accept |
| `src/lib/together.ts` | Add pass-the-phone participants, handoff state, `ready_at`, reveal timing (R17–R18) |
| `src/lib/swipes.ts` | Swipe, undo, veto, finish round, batch apply with `client_id` idempotency (R32) |
| `src/lib/participants.ts` | Start over, late join, remove, leave, reminders, solo-board eligibility (R31) |
| `src/lib/reactions.ts` | Reactions + notes, "Not for us", all-❤️ → shopping list (R29) |
| `src/lib/swap.ts` | Swap / undo swap using the stored swap queue (R28) |
| `src/lib/brief.ts` | Style brief view-model (R30) |
| `src/lib/budget-total.ts` | Shopping list total vs band (R34) |
| `src/lib/rate-limit.ts` | Fixed-window limits (R36) |
| `src/lib/my-data.ts` | Export and delete (R37) |
| `src/lib/locale.ts` | GBP, cm, en-GB formatting (R38) |
| `src/lib/images/check.ts` | Image checks + failure counting (R33) |
| `src/lib/client/swipe-queue.ts` | Browser: IndexedDB queue, batch flush, online/visibility listeners (R32) |
| `src/lib/client/prefetch.ts` | Browser: deck + next-6 image prefetch, failed-image reporting and reserve swap-in (R32–R33) |
| `src/lib/reveal.ts` | Reveal rules (R10, R18) |
| `src/lib/board.ts` | Board view-model incl. lead section and evidence |
| `src/lib/personal-result.ts` | Personal style card (R23) |
| `src/lib/project-state.ts` | Polling payload |
| `src/lib/share.ts` | Create/revoke share links, public view-model (no swipes/vetoes/names unless chosen) |
| `src/lib/shopping-list.ts` | List, bought-it, email list |
| `src/lib/alerts.ts` | Subscribe/unsubscribe, find price drops, build digests |
| `src/lib/partners.ts` | Partner lookup, attribution, usage report |
| `src/lib/waitlist.ts` | Fake-door sign-ups |
| `src/lib/notify.ts` | Board-ready, shopping-list and price-drop emails (Resend) |
| `src/lib/analytics.ts` | Server-side PostHog |
| `src/lib/unsplash.ts` | Search, mapping, `trackDownload()` |
| `src/lib/catalogue/feeds.ts`, `category-map.ts`, `upsert.ts`, `refresh.ts` | Feed import + nightly refresh |
| `src/lib/stats/item-stats.ts` | Nightly aggregation + smoothing (§12) |
| `src/lib/seo/pair-pages.ts` | Compute pair content with the engine; load published pages |
| `src/lib/ai/anthropic.ts` | Client, `CLAUDE_MODEL = "claude-opus-5-5"`, `parseStructured()` (stop-reason/refusal checks) |
| `src/lib/ai/schemas.ts` | `ItemTagsSchema`, `BridgeNameSchema`, `PairPageSchema` |
| `src/lib/ai/prompts/tag-item.ts`, `bridge-name.ts`, `pair-page.ts` | Prompts (taxonomy prefix cached) |
| `src/lib/ai/tag-batch.ts`, `bridge-name.ts`, `pair-page.ts` | Calls + fallbacks |
| `src/lib/embeddings/voyage.ts` | `embedItems()`, `embedText()` |
| `src/lib/engine/vector.ts` | Vector maths |
| `src/lib/engine/rng.ts` | Seeded PRNG + shuffle |
| `src/lib/engine/quotas.ts` | Category quotas + redistribution for kept categories |
| `src/lib/engine/constraints.ts` | Budget, size limits, kept categories (R13, R14, R16) |
| `src/lib/engine/household.ts` | Practicality penalties (R15) |
| `src/lib/engine/harmony.ts` | Anchor colour/material harmony (R14) |
| `src/lib/engine/deck.ts` | §11.1 |
| `src/lib/engine/profile.ts` | §11.2 |
| `src/lib/engine/matches.ts` | §11.3 steps 1–3 |
| `src/lib/engine/evidence.ts` | §11.3 step 4 |
| `src/lib/engine/bridge.ts` | §11.3 step 5 |
| `src/lib/engine/contributions.ts` | §11.3 step 6 |
| `src/lib/engine/compromise.ts` | §11.3 steps 7–8 (scoring, balanced greedy, MMR) |
| `src/lib/engine/synthesise.ts` | Orchestration, layout decision, `inputs_hash` |
| `src/lib/engine/tiebreak.ts` | §11.4 |
| `src/lib/engine/swap.ts` | Next candidate from the swap queue, skipping shown/swapped/vetoed (R28) |
| `src/lib/engine/feedback.ts` | Turns reactions and swaps into extra swipe signals for recomputes |
| `src/lib/synthesis.ts` | Load inputs, run engine, persist, name in `after()` |
| `src/lib/validation.ts` | Zod inputs for every action/route |

### 13.5 `src/app/`: routes

| File | Purpose |
|---|---|
| `src/app/layout.tsx`, `globals.css`, `providers.tsx` | Shell, theme, TanStack Query + PostHog, footer disclosure |
| `src/app/manifest.ts`, `icon.svg`, `apple-icon.png` | PWA |
| `src/app/sitemap.ts`, `src/app/robots.ts` | SEO |
| `src/app/page.tsx` | Landing: "Settle your room style together in 5 minutes" → Start together / Take the quiz |
| `src/app/quiz/page.tsx` | Solo quiz entry: pick room → swipe (§4.1) |
| `src/app/start/page.tsx`, `src/app/start/actions.ts` | Room type, name, budget → `createProject` |
| `src/app/projects/page.tsx` | My projects |
| `src/app/r/[projectId]/setup/page.tsx`, `actions.ts` | Room context (R14–R16) + mode choice (R17) |
| `src/app/r/[projectId]/page.tsx`, `actions.ts` | Hub: participants, progress, invite panel, Ready/reveal, links |
| `src/app/r/[projectId]/swipe/page.tsx`, `actions.ts` | Swipe flow incl. pass-the-phone handoff screens |
| `src/app/r/[projectId]/me/page.tsx` | Personal result (R23) |
| `src/app/r/[projectId]/me/opengraph-image.tsx` | Shareable personal result image |
| `src/app/r/[projectId]/reveal/page.tsx` | Ready? → synchronised countdown (R18) |
| `src/app/r/[projectId]/board/page.tsx`, `actions.ts` | Board; tie-breaker, feedback, share, shopping list, alerts, next room, fake door |
| `src/app/r/[projectId]/tiebreak/page.tsx` | Tie-breaker swipes |
| `src/app/r/[projectId]/brief/page.tsx` | Printable style brief (R30) |
| `src/app/r/[projectId]/brief/image/route.tsx` | Style brief as a PNG (`ImageResponse`) for "Save as image" |
| `src/app/settings/page.tsx`, `actions.ts` | Account, email, export/delete my data (R37) |
| `src/app/j/[token]/page.tsx`, `actions.ts` | Join as guest |
| `src/app/s/[shareId]/page.tsx` | Public share page |
| `src/app/s/[shareId]/opengraph-image.tsx` | Share image |
| `src/app/with/[partner]/page.tsx` | Partner co-branded landing |
| `src/app/styles/[style]/page.tsx` | Style SEO page |
| `src/app/combine/[pair]/page.tsx` | Style-pair SEO page |
| `src/app/designers/page.tsx`, `actions.ts` | Designers fake door + interest form |
| `src/app/go/[itemId]/route.ts` | Click log + affiliate redirect (`?s=board|share|email|seo`) |
| `src/app/unsubscribe/[token]/route.ts` | One-click unsubscribe (also used as the `List-Unsubscribe` header URL) |
| `src/app/admin/catalogue/page.tsx`, `actions.ts` | Catalogue review |
| `src/app/admin/pages/page.tsx`, `actions.ts` | SEO page review/publish |
| `src/app/admin/partners/page.tsx`, `actions.ts` | Partner links + usage |
| `src/app/admin/metrics/page.tsx` | DB-backed metrics |
| `src/app/privacy/page.tsx`, `src/app/disclosure/page.tsx` | Privacy (guests, analytics, aggregates) + affiliate disclosure |
| `src/app/not-found.tsx`, `src/app/error.tsx` | — |
| `src/app/api/auth/[...all]/route.ts` | Better Auth |
| `src/app/api/projects/[projectId]/state/route.ts` | Polling JSON |
| `src/app/api/projects/[projectId]/qr/route.ts` | QR SVG |
| `src/app/api/cron/refresh-feeds/route.ts`, `price-alerts/route.ts`, `item-stats/route.ts`, `check-images/route.ts` | Crons (check `CRON_SECRET`) |
| `src/app/api/swipes/route.ts` | Batch swipe/undo/veto endpoint for the offline queue (R32) |
| `src/app/api/report-image/route.ts` | Client-reported image failures (R33) |
| `src/app/api/me/export/route.ts` | JSON download of my data (R37) |
| `src/app/api/test/sign-in/route.ts` | E2E only |
| `src/proxy.ts` | Protects `/projects`, `/admin` |

### 13.6 `src/components/`

| File | Purpose |
|---|---|
| `src/components/ui/*` ✱ | shadcn: button, card, dialog, sheet, input, label, select, switch, tabs, sonner, avatar, badge, progress, skeleton, tooltip |
| `src/components/Header.tsx` | Logo, user menu / "Save with Google" |
| `src/components/RoomTypePicker.tsx`, `BudgetPicker.tsx` | Setup |
| `src/components/context/KeepingPicker.tsx` | Categories + colour/material chips (R14) |
| `src/components/context/HouseholdPicker.tsx` | Dog / cat / kids (R15) |
| `src/components/context/SizeLimits.tsx` | Optional max sizes (R16) |
| `src/components/ModePicker.tsx` | Link / two phones / one phone (R17) |
| `src/components/InvitePanel.tsx` | Copy, native share, QR; partner-facing copy |
| `src/components/ParticipantProgress.tsx` | Avatars + progress |
| `src/components/SwipeDeck.tsx` | Gestures, keyboard, buttons, undo, preloading, progress, "≈ 3 min" estimate |
| `src/components/SwipeCard.tsx` | Image, title/price, attribution, "Goes with your grey sofa" |
| `src/components/HandoffScreen.tsx` | Pass-the-phone cover screen (R17) |
| `src/components/CardDetailSheet.tsx` | Product/photo details with swipe and veto inside (R27) |
| `src/components/SwipeHint.tsx` | First-run drag demo and veto explainer (R35) |
| `src/components/OfflinePill.tsx` | "Saved, will sync" indicator (R32) |
| `src/components/ReminderButton.tsx` | Share-sheet reminder (R31) |
| `src/components/ParticipantMenu.tsx` | Start over, leave, remove (creator) (R31) |
| `src/components/VetoSheet.tsx` | Veto + optional reason chips |
| `src/components/RoundInterstitial.tsx` | Macro → micro |
| `src/components/MyStyleCard.tsx` | Personal result (R23) |
| `src/components/RevealCountdown.tsx` | Ready + countdown (R18) |
| `src/components/board/BridgeStyleHero.tsx` | Name, tagline, rationale, hybrid rooms |
| `src/components/board/EvidenceStrip.tsx` | "You both said yes to…" with each person's cards (R19) |
| `src/components/board/WhatYouEachBring.tsx` | Contributions (R21) |
| `src/components/board/AgreedItems.tsx` | Exact matches |
| `src/components/board/LovedRooms.tsx` | Exact macro matches |
| `src/components/board/SharedElements.tsx` | Shared / differ chips |
| `src/components/board/CompromisePicks.tsx` | "Works for both of you", anchor and household badges, hide switch |
| `src/components/board/OffTheTable.tsx` | Anonymous vetoes (R22) |
| `src/components/board/ShoppingList.tsx` | Bought-it, email list, alerts opt-in (R25–R26) |
| `src/components/board/BudgetTotal.tsx` | Total vs budget band (R34) |
| `src/components/board/ItemReactions.tsx` | ❤️ / 🤔 / ✕ per person + one-line note (R29) |
| `src/components/board/NotForUs.tsx` | Collapsed section of ✕ items (R29) |
| `src/components/board/SwapButton.tsx` | "Not quite, show me another" + undo toast (R28) |
| `src/components/board/SoloBanner.tsx` | "Your board for now" + reminder (R31) |
| `src/components/board/BoardUpdatedNotice.tsx` | "Board updated: Alex joined" (R31) |
| `src/components/brief/StyleBrief.tsx` | Print layout of the brief (R30) |
| `src/components/board/TiebreakCta.tsx`, `NextRoomCta.tsx`, `ShareBoard.tsx`, `BoardFeedback.tsx` | Board actions |
| `src/components/FakeDoor.tsx` | "See it in your room" coming-soon + waitlist (§5) |
| `src/components/PartnerBanner.tsx` | Co-branding on partner-started projects |
| `src/components/ProductCard.tsx` | Product, price, stock, Buy |
| `src/components/Attribution.tsx`, `AffiliateNotice.tsx` | Credits and disclosure |
| `src/components/admin/CatalogueGrid.tsx`, `CoverageGrid.tsx`, `TagEditor.tsx`, `PairPageEditor.tsx` | Admin |
| `src/hooks/useProjectState.ts` | Polling (2 s in together mode / while swiping; stops after reveal) |
| `src/emails/BoardReady.tsx`, `ShoppingList.tsx`, `PriceDrop.tsx` | React Email templates (unsubscribe footer on the last two) |

### 13.7 `scripts/`

`import-photos.ts`, `import-feed.ts`, `tag-catalogue.ts`, `embed-catalogue.ts`, `build-style-centroids.ts`, `generate-pair-pages.ts`, `import-concierge.ts`, `seed-dev.ts` (§10.2).

### 13.8 `tests/`

| File | Purpose |
|---|---|
| `tests/setup/msw.ts`, `tests/mocks/{anthropic,voyage,unsplash,resend}.ts` | Fakes |
| `tests/fixtures/catalogue.json` | Synthetic catalogue (also the dev seed) |
| `tests/fixtures/industrial-vs-minimalist.json`, `keeping-grey-sofa.json`, `dog-household.json` | §11.5 |
| `tests/fixtures/concierge/*.json` | Real Phase −1 data |
| `tests/fixtures/awin-feed.csv` | Sample feed incl. bad rows |
| `tests/helpers/db.ts`, `tests/helpers/vectors.ts` | Factories, synthetic vectors |
| `tests/unit/vector.test.ts` | — |
| `tests/unit/deck.test.ts` | Same cards for all; kept categories removed and quotas redistributed; size/budget filters; uninformative cards skipped; next-room seeding; determinism |
| `tests/unit/profile.test.ts` | Taste vector, affinities, personal result text inputs |
| `tests/unit/matches.test.ts`, `evidence.test.ts` | Double rights, shared/conflicts, evidence lists |
| `tests/unit/bridge.test.ts` | Maximin, "already agree" |
| `tests/unit/contributions.test.ts` | Everyone brings ≥ 1 element |
| `tests/unit/compromise.test.ts` | Exclusions, anchors, household penalties/hide, balanced selection gap, MMR, ≤ 2 per category |
| `tests/unit/synthesise.test.ts` | All §11.5 fixtures incl. concierge; N = 3 |
| `tests/unit/board-layout.test.ts` | Lead section switch; "0 matches" never rendered |
| `tests/unit/item-stats.test.ts` | Smoothing, thresholds |
| `tests/unit/swap.test.ts` | Same category, skips shown/swapped/vetoed, exhaustion message |
| `tests/unit/feedback.test.ts` | Reactions and swaps become signals; recompute moves picks |
| `tests/unit/solo-board.test.ts` | N = 1 synthesis and layout |
| `tests/unit/budget-total.test.ts` | Totals, out-of-stock excluded, no band |
| `tests/unit/swipe-queue.test.ts` | Queue, batch flush, retry, idempotency (jsdom + `fake-indexeddb`) |
| `tests/unit/locale.test.ts` | £ and cm formatting |
| `tests/unit/feeds.test.ts`, `ai-schemas.test.ts` | Parsing; AI output validation and fallbacks; naming prompt guard (no scores/winner words) |
| `tests/integration/invites.test.ts`, `swipes.test.ts`, `reveal.test.ts` | Core rules |
| `tests/integration/together.test.ts` | Pass-the-phone host permissions; Ready + reveal timing |
| `tests/integration/guest-upgrade.test.ts` | Guest → Google keeps participants, list, alerts |
| `tests/integration/share.test.ts` | Public view hides swipes/vetoes/names; revoke |
| `tests/integration/alerts.test.ts` | Drop detection, weekly cap, unsubscribe |
| `tests/integration/next-room.test.ts` | Same people joined, context copied |
| `tests/integration/refresh.test.ts`, `access-control.test.ts` | Feeds; non-participants 404 |
| `tests/integration/participants.test.ts` | Start over, late join recompute, remove/leave cascade + recompute |
| `tests/integration/reactions.test.ts` | All-❤️ → shopping list; ✕ → Not for us; note length |
| `tests/integration/swipe-batch.test.ts` | Duplicate `client_id`s ignored; out-of-order batches |
| `tests/integration/rate-limit.test.ts` | Windows, limits, reset |
| `tests/integration/my-data.test.ts` | Export contents; delete cascades and others' boards recompute |
| `tests/integration/check-images.test.ts` | Failure counting, retire at 2, reset on success |
| `tests/e2e/remote-partners.spec.ts` | A creates → B joins via link → both swipe → reveal → board |
| `tests/e2e/pass-the-phone.spec.ts` | One context, two people, handoff hides progress |
| `tests/e2e/live-reveal.spec.ts` | Two contexts reveal together after both tap Ready |
| `tests/e2e/solo-quiz.spec.ts` | Quiz → personal result → invite → partner finishes → board |
| `tests/e2e/no-match-board.spec.ts` | Opposite swipes → bridge-led board with evidence |
| `tests/e2e/context.spec.ts` | Keeping sofa → no sofa cards; dog → badges + hide |
| `tests/e2e/share.spec.ts`, `veto.spec.ts`, `tiebreak.spec.ts`, `mobile-swipe.spec.ts` | — |
| `tests/e2e/offline-swipe.spec.ts` | `context.setOffline(true)` mid-deck → keep swiping → back online → all swipes saved once |
| `tests/e2e/card-detail.spec.ts` | Open details, swipe from the sheet |
| `tests/e2e/swap-and-react.spec.ts` | Swap a pick + undo; both ❤️ → shopping list; ✕ → Not for us |
| `tests/e2e/brief.spec.ts` | Brief renders all sections; image route returns a PNG |
| `tests/e2e/broken-image.spec.ts` | Route an image to 404 → card replaced from reserves |
| `tests/e2e/solo-board.spec.ts` | Partner never finishes → "my board for now" → partner finishes → shared board |

---

## 14. Build order

### Phase −1: Validate (1–2 weekends, no code)

§2. **Gate:** don't start Phase 1 unless the go/no-go table passes (Phase 0 can run in parallel, since the landing page helps affiliate applications anyway).

### Phase 0: Skeleton (½ day)

Next.js, pnpm, Tailwind, shadcn, lint/format, Vitest, Playwright, MSW, CI, Docker Compose, `env.ts`; landing page live on your domain with a waitlist form.

**Done when:** CI is green and the landing page is live.

### Phase 1: Catalogue (5 days + curation)

Taxonomy (incl. practical tags and dimensions), schema, import scripts, tagging, embeddings, centroids, admin catalogue, dev seed, concierge import. Curate the living room first.

**Done when:** the living-room coverage grid has no empty style × tier cells; 27 of 30 spot-checked items have tags you agree with; ≥ 50% of sofas/rugs/tables have dimensions.

### Phase 2: Projects, guests, context (3 days)

Better Auth (guests + Google + linking), `/start`, `/quiz`, setup page (room context + mode choice), hub, invites + QR, permissions, rate limits (R36), `locale.ts` (R38).

**Done when:** on a phone, you can start the quiz with no account, set "keeping a grey sofa, we have a dog", and invite a second phone that joins with just a name; the 21st join on one invite within an hour gets the "Slow down" message.

### Phase 3: Swiping, together mode, personal result (5½ days)

Deck builder (context, stats filter, next-room seeding, reserves), `SwipeDeck`, card details sheet (R27), first-run hint (R35), vetoes, interstitial, offline queue + batch route + prefetch (R32), image-failure swap-in (R33), start over (R31), pass-the-phone handoff, personal result + its share image, Ready + reveal countdown.

**Done when:** 30 swipes take under 3 minutes on a mid-range phone; pass-the-phone never shows the previous person's choices; two phones reveal within a second of each other; no sofa cards appear when you're keeping the sofa; switching to aeroplane mode halfway through still lets you finish the deck, and every swipe is saved exactly once when you reconnect.

### Phase 4: Engine and board (6½ days)

Engine test-first against all §11.5 fixtures (including concierge data); persistence; naming in `after()` with fallback; adaptive board layout, evidence, what-you-each-bring, anonymous vetoes, badges and hide switch; swap queue + "show me another" (R28); reactions and notes (R29); budget total (R34); solo board, reminders, late joiners, remove/leave (R31); `/go`; board-ready email.

**Done when:** an Industrial-vs-Minimalist test couple gets a bridge-led board that never says "0 matches", in which both people see something of theirs; on your concierge fixtures the engine's bridge matches (or plausibly beats) the one you made by hand; swapping a pick is instant; both tapping ❤️ puts an item on the shopping list; a partner who never finishes leaves you with a usable solo board.

### Phase 5: Tie-breaker (1–2 days)

**Done when:** a mutual yes moves an item into Agreed and onto the shopping list; a third round isn't offered.

### Phase 6: Growth (3 days)

Share page + OG images, partner landing pages + admin + attribution, `/styles` and `/combine` pages with the generate/review/publish flow, sitemap.

**Done when:** a shared board link previews nicely in WhatsApp; a project started from `/with/[partner]` shows up in that partner's report; 10 reviewed pair pages are published and listed in the sitemap.

### Phase 7: Retention and revenue (4 days)

Shopping list + email + bought-it, style brief page and image (R30), price alerts + unsubscribe, next room, "See it in your room" fake door, designers page, `item_stats` cron and its use in decks and scoring, `check-images` cron (R33).

**Done when:** a 10% price drop on an alerted item sends one digest with a working unsubscribe; "Next room" creates a project with both people already in it; the style brief prints on one A4 page and saves as an image on a phone; fake-door taps and sign-ups appear in admin metrics.

### Phase 8: Launch (3½ days)

Bedroom and dining catalogues, settings with export/delete my data (R37), PostHog funnels (§15), Sentry, crons live, privacy/disclosure, accessibility pass (buttons for every gesture, alt text from tags, contrast, reduced-motion countdown and hint), README.

**Done when:** all E2E specs pass; 5 new couples (not from Phase −1) complete a project unassisted, at least one in each mode; deleting a test account removes all its rows and the partner's board recomputes.

**Rough total:** ~6½ weeks of engineering + catalogue curation, after the validation weekend(s).

---

## 15. Analytics events (PostHog)

- **Acquisition:** `landing_viewed` (source: direct/partner/seo/share), `quiz_started`, `project_created` (room_type, mode, has_context, ref_partner), `share_page_viewed`, `seo_page_viewed`.
- **Activation:** `invite_shared` (copy/share/qr), `invite_opened`, `partner_joined`, `context_set` (fields), `swipe` (sampled), `veto_used`, `round_finished` (duration_ms), `personal_result_viewed`, `personal_result_shared`, `quiz_to_invite`.
- **The moment:** `ready_tapped`, `board_revealed` (participants, mode, lead: agreed/bridge, exact_matches), `bridge_named` (ai_ok/fallback), `board_feedback` (helpful).
- **Using the board:** `card_detail_opened` (tier), `hint_completed`, `pick_swapped` (category), `swap_undone`, `item_reacted` (reaction), `note_added`, `brief_viewed`, `brief_printed`, `brief_image_saved`, `reminder_sent`, `solo_board_viewed`, `started_over`, `late_joiner_finished`, `participant_removed`, `offline_swipes_synced` (count), `image_failed`, `rate_limited` (key type), `data_exported`, `data_deleted`.
- **After:** `tiebreak_finished`, `board_shared`, `shopping_list_emailed`, `bought_marked`, `price_alert_subscribed`, `price_alert_clicked`, `next_room_started`, `buy_clicked` (surface, retailer, price band).
- **Revenue tests:** `fake_door_tapped` (see_in_room), `waitlist_joined` (feature), `designer_form_submitted`.

Dashboards: core funnel (§1), quiz → invite → board, mode comparison (completion and helpfulness by mode), board lead type vs helpfulness (does the no-match layout work?), revenue tests.

---

## 16. Running locally

```bash
pnpm install
cp .env.example .env        # DATABASE_URL, TEST_DATABASE_URL, BETTER_AUTH_*, GOOGLE_* are enough for dev
pnpm db:up && pnpm db:migrate
pnpm db:seed                # fixture catalogue, no API keys
pnpm dev                    # http://localhost:3000
```

Catalogue and page scripts need the Anthropic, Voyage, Unsplash and Awin keys; run them against a Neon branch first. Test pass-the-phone in one browser window and live reveal in two (e.g. a normal and a private window).

---

## 17. Costs

| Item | Cost | Notes |
|---|---|---|
| Phase −1 | ≈ £100–150 | Vouchers for 10–15 couples |
| Tagging the catalogue (≈ 1,700 items, Batches) | ≈ $10 one-off | New items only afterwards |
| Embeddings | < $1 one-off | |
| SEO pair pages (60) | ≈ $2 one-off | Plus your review time |
| Bridge naming | ≈ $0.01 per board version | The only per-user AI cost |
| Unsplash, Awin, PostHog, Resend, Sentry, Neon, Vercel | Free tiers cover the MVP | Check limits before a launch spike |

Revenue per board: see the formula in §5.

---

## 18. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Couples don't find the bridge useful | Phase −1 gate before any engine work |
| R2 | The catalogue is samey or wrong | Curation time, coverage grid, spot checks, uninformative-card filter |
| R3 | Nobody finds the app | Four channels from day one (§4), measured separately; Phase −1 says which to lead with |
| R4 | Affiliate revenue is too thin | Three other revenue lines tested by fake doors and B2B conversations (§5); plain links work if approvals lag |
| R5 | Suggestions don't fit real homes | Room context (R14–R16); "Check the size" when dimensions are unknown; hide-risky switch |
| R6 | One partner feels they lost | No scores, balanced selection, everyone brings something, anonymous vetoes, naming prompt rules, unit-tested (R20–R22) |
| R7 | Partner B drops off | Pass-the-phone, 3-minute decks, personal result reward, partner-facing invite copy; completion by mode tracked |
| R8 | 30 swipes is a thin signal | Diverse decks, smoothing, evidence on the board, tie-breaker, item stats over time |
| R9 | Unsplash/affiliate terms | Hotlinking, attribution and download pings built in; share images use product images, not Unsplash; disclosure everywhere |
| R10 | Email compliance (UK PECR/GDPR) | Alerts and lists are opt-in; one-click unsubscribe + `List-Unsubscribe` header; board-ready email is transactional to the creator only |
| R11 | Thin AI SEO pages hurt rankings | Content computed from real catalogue data, every page reviewed before publishing, start with 10–20 not 60 |
| R12 | Fake doors feel deceptive | Say "coming soon" immediately, never ask for payment details, offer a waitlist |
| R13 | Someone already built this | Competitor scan in Phase −1; the reconciliation layer (bridge, balance, evidence) is the part to protect |
| R14 | Swaps and ✕ reactions quietly drain a category | Swap queue of 10 per category; clear "that's everything at this budget" message; `pick_swapped` by category shows where the catalogue is thin |
| R15 | Offline swipes arrive late or twice | `client_id` idempotency, batch endpoint tolerant of order; reveal waits until the participant's queue is empty |

---

## 19. After the MVP

### 19.1 v1.1 (first month after launch)

| Feature | What it is | Notes |
|---|---|---|
| **Paint colour matches** | Each palette swatch on the board and the brief shows its closest paint colour from a UK paint range ("closest: Dulux Sage Whisper"), using colour distance (CIEDE2000) against a stored colour list, with a link to buy a tester pot. | Paint is the cheapest, most concrete first purchase. **Check the licence for the paint brand's colour data first**: use a brand's published API/feed or a licensed dataset, never scraped colour lists. Some paint retailers run affiliate programmes. |
| **Add your own find** | Paste a product link (any retailer) → the server fetches the page's Open Graph title, image and price → Claude tags it like a catalogue item (one live call) → it joins the next tie-breaker round for your partner to swipe. Affiliate link via Skimlinks where possible. | User-added items stay private to the project and never enter the shared catalogue without admin review. |
| **Board filters** | Filter the board and shopping list by category ("just rugs") and by retailer. | Client-side only; no new data. |
| **Web push** | "Sam has finished" and "Board updated" as push notifications, with email as the fallback. | Web Push API with VAPID keys (`web-push` package). On iPhone, web push only works once the app has been added to the home screen, so prompt for that first. |

### 19.2 v2

- **See it in your room** (if the fake door converts): upload a room photo and render the agreed board into it with an image-editing model (Claude writes the brief, an image model renders, Vercel Blob stores). Paid, per §5.
- **Designer plan** (if the interest form converts): branded projects, client list, designers' own product lists.
- **Floorplans:** read a floorplan to fill in R16 sizes automatically.
- **Whole-home profile:** one shared taste profile across rooms.
- **Adaptive decks:** a second macro round chosen where the taste vectors disagree most.
- **Kitchen and bathroom** decks (finish- and fixture-led).
- **Learned ranking** from the flywheel data once there are thousands of boards.
- **Native app** if the web funnel proves out.

---

## 20. Non-goals (deliberately not building)

Each of these pulls Hearth towards a product it's trying not to be. Revisit only with evidence from users, not because a competitor has it.

| Not building | Why not |
|---|---|
| **Full chat** | Couples already have WhatsApp. Reactions and one-line notes on items (R29) cover discussion where it matters; threads would turn the board into a messaging app nobody checks. |
| **3D room planning or AR** | That's Planner 5D and Homestyler's territory: heavy setup, built for layout rather than agreement. Size limits (R16) and the v2 "see it in your room" photo cover the practical need. |
| **User-uploaded inspiration feeds** | That's Pinterest: endless boards, no decisions. "Add your own find" (v1.1) is deliberately one item at a time, private, and only to be swiped. |
| **Social features** (followers, public profiles, likes, comments from strangers) | The product is private agreement between people who live together. Public share pages (§4.2) are read-only and exist for acquisition, not community. |
