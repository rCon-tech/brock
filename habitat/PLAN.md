# Habitat: Build Plan

**Habitat** is a private social network that belongs to one group of friends. You make a Habitat with your friends and it works as your own small Facebook. It is built from **modules**: Feed, Photos, Events, Chat, Polls and so on. The members decide together which modules to add or remove. It ships with a library of modules and starts with the usual social network features. Later, an AI chatbot will build custom modules for a group (§13).

This document covers everything needed to build v1: the rules, the technology, every file, the data model, the module contract, the API and the build order. No code exists yet. Each phase in §11 ends with acceptance criteria, so whoever builds it knows when a phase is finished.

> **Where this lives.** Habitat is a separate product from Brock. Start it in a new repository called `habitat`. This file is meant to become that repo's `PLAN.md`. The stack deliberately matches Brock's (Next.js, Drizzle, Postgres, Vitest, Playwright, Vercel + Neon), so the tooling and habits carry over.

---

## 1. Product rules (decide these first)

These defaults turn "a private mini Facebook that friends customise together" into exact rules. Each one lives in a single file in `src/lib/` so it can be changed in one place. Read them before building, and change anything that doesn't fit how your group behaves.

| # | Rule | Default | Why |
|---|------|---------|-----|
| H1 | Who can see a Habitat | **Members only.** Nothing is public, nothing is indexed by search engines, and there is no global search or "people you may know". | This is the selling point: it's yours, not a public square. |
| H2 | Size | **2 to 150 members** (`habitat.member_cap`, which an owner can lower) | 150 is Dunbar's number. Past that, it's a community rather than a group of friends. |
| H3 | Joining | **Invite link only.** Codes are 10 characters of base32 (50 bits), expire after 7 days by default, and can be limited to a number of uses. Any member can invite unless an admin turns that off. | Friends invite friends. No discovery, no join requests from strangers. |
| H4 | Roles | **Owner** (exactly 1), **Admin** (any number), **Member** | The owner can transfer ownership and delete the Habitat. Admins moderate, manage invites and change settings. Members post and vote. |
| H5 | Starting modules | **Feed, Photos, Events, Chat** are installed when a Habitat is created. The creator can untick any of them in the wizard. **Members** and **Notifications** are core and cannot be removed. | Familiar social network norms on day one. |
| H6 | Adding or removing a module | **Any member can propose. The group votes.** One open proposal per module at a time. | "Between you and your friends you decide" is the core mechanic. |
| H7 | How a vote is decided (governance `majority`, the default) | It **passes as soon as** yes votes are more than half of the current members. It **fails as soon as** no votes are at least half. When the **48-hour window** closes, it passes if yes > no **and** at least ⅓ of members voted. Otherwise it fails. | Decides quickly in active groups, and still finishes in quiet ones. In a 2-person Habitat both must agree. |
| H8 | Other governance modes | `unanimous` (every member votes yes; any no fails it) and `admins` (any admin's yes or no decides it immediately). Changing the mode is itself a proposal. | Some groups want a benevolent dictator, others want consensus. |
| H9 | Removing a module | Its data is **hidden, not deleted**, for 30 days. Reinstalling within 30 days brings everything back. After 30 days a nightly job deletes it. | Nobody loses the group's photos because of one vote. |
| H10 | Feed order | **Newest first, no algorithm, no ads**, with pinned posts on top (admins pin) | Friends want to see everything, in order. |
| H11 | Reactions | A fixed set of 6: ❤️ 😂 😮 😢 👍 🎉. One of each per person per item. | Simple and expressive. Custom emoji can come later. |
| H12 | Comments | One level of replies (a comment can have replies, a reply can't). Authors can edit and delete their own comments, and admins can delete any. | Threads stay readable on a phone. |
| H13 | Leaving | Your content stays, credited to "former member", unless you tick "delete everything I posted" when you leave. | Group history shouldn't break when someone leaves, but people can always take their content back. |
| H14 | Many Habitats | One account can be in any number of Habitats. Your name and avatar are global, and you can set a nickname per Habitat. | Family, uni friends and five-a-side are different groups. |
| H15 | Identity | **Email magic link or Google** sign-in. No passwords. | A real social network needs real accounts. Magic links keep sign-up quick. |
| H16 | Photo privacy | Photos are re-encoded in the browser before upload, which **removes EXIF data (including GPS)**. They are stored in a private bucket and only served to members through short-lived signed URLs. | Holiday photos shouldn't leak someone's home address. |

---

## 2. Technology (every piece)

| Layer | Choice | Version target | Purpose |
|---|---|---|---|
| Language | **TypeScript** | 5.9.x, `strict: true` | One language for client, server, modules and tests |
| Runtime | **Node.js** | 24 LTS (pinned in `.nvmrc`) | Server runtime, locally and on Vercel |
| Package manager | **pnpm** | 10.x | Fast, strict installs. The lockfile is committed. |
| Framework | **Next.js** (App Router) | 16.x | Pages, server components, route handlers and `proxy.ts` (the Next 16 name for middleware) |
| UI library | **React** | 19.x | Comes with Next.js |
| Styling | **Tailwind CSS** | 4.x (with `@tailwindcss/postcss`) | Utility CSS. Each Habitat's accent colour is a CSS variable. |
| Components | **shadcn/ui** (on **Radix UI**) | latest CLI | Accessible dialogs, menus, tabs and sheets, copied into `src/components/ui/` |
| Icons | **lucide-react** | latest | Icons for the UI and for modules |
| Toasts | **sonner** | 2.x | "Posted", "Vote recorded" and similar confirmations |
| Client data cache | **TanStack Query** (`@tanstack/react-query`) | 5.x | Caching, infinite scroll and optimistic updates for the records API |
| Dates | **date-fns** | 4.x | "3h ago", event times, birthday maths |
| Database | **PostgreSQL** | 16+ | Durable data, JSONB for module records, transactions for votes |
| Hosted DB | **Neon** (serverless Postgres) | — | Free tier, integrates with Vercel |
| Local DB | **Docker Compose** running `postgres:16` | — | Same engine for dev (port 5432) and tests (port 5433) |
| ORM / migrations | **Drizzle ORM** + **drizzle-kit** | 0.45 / 0.31 | Type-safe SQL and generated migrations |
| DB driver | **postgres** (postgres.js) | 3.x | TCP driver with transactions and `FOR UPDATE` |
| Auth | **Better Auth** (Drizzle adapter, `magicLink` plugin, Google provider) | 1.x | Sessions, magic links, OAuth and built-in rate limiting |
| Email | **Resend** + **React Email** (`@react-email/components`) | latest | Magic links, invites, vote notices, event reminders and the weekly digest |
| File storage | **Cloudflare R2** (S3-compatible) via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | v3 | Private photo storage. The browser uploads directly with presigned PUT URLs. |
| Image prep | **browser-image-compression** | 2.x | Resizes (2048px full size plus a 480px thumbnail) and strips EXIF in the browser before upload |
| Realtime | **Ably** (`ably`) | 2.x | Live chat, typing indicators and live notification counts. Token auth with one channel per Habitat. |
| Validation | **Zod** | 4.x | Request bodies, env vars, module manifests and module record data |
| Crypto | Node **`crypto`** (built in) | — | Invite codes (`randomBytes`) and invite-code hashing (`createHash('sha256')`) |
| Scheduled jobs | **Vercel Cron** (`vercel.json`) | — | Closing expired votes, event and birthday reminders, the weekly digest and purging removed module data |
| Error monitoring | **Sentry** (`@sentry/nextjs`) | latest | Server and client error reports |
| Unit and integration tests | **Vitest** | 3.x | Pure logic, plus services against a real Postgres |
| End-to-end tests | **Playwright** (`@playwright/test`) | 1.6x | Two browsers: one creates a Habitat, the other joins and votes |
| Lint / format | **ESLint** (flat config, `eslint-config-next`) + **Prettier** | latest | Keeps code consistent |
| CI | **GitHub Actions** | — | Lint, typecheck, unit, integration (Postgres service container) and E2E on every PR |
| Hosting | **Vercel** | — | Next.js deploys, preview URLs per PR, and Cron |
| AI (**after v1**, §13) | **Claude API** via `@anthropic-ai/sdk` | latest | The module builder chatbot. The model ID comes from `ANTHROPIC_MODEL`. |

**Not used, on purpose:**
- No Redis. Postgres handles rate limits (the `rate_limit` table, as in Brock), and vote decisions use row locks.
- No queue service. Notifications are written in the same transaction as the action that caused them. Emails are sent after the commit, and Cron catches anything that failed.
- No global state library. Server components and TanStack Query cover it.
- No rich-text editor. Posts are plain text with automatic links and @mentions, which keeps XSS risk low.
- No native apps in v1. The site is a responsive PWA-ready web app designed for phones first.

---

## 3. Every file to create

```
habitat/
├── .github/
│   └── workflows/
│       └── ci.yml                                   # Lint, typecheck, unit, integration (pg service), e2e
├── drizzle/                                         # GENERATED by `pnpm db:generate`; never hand-edit
│   ├── 0000_initial.sql
│   └── meta/                                        # drizzle-kit snapshots (generated)
├── public/
│   ├── favicon.ico
│   ├── icon-192.png                                 # PWA / home-screen icon
│   ├── icon-512.png
│   ├── manifest.webmanifest                         # "Add to home screen"
│   └── og.png                                       # 1200×630 preview for the landing page only
├── src/
│   ├── proxy.ts                                     # Next 16 proxy: redirect signed-out users away from /h/*, /new, /settings
│   ├── instrumentation.ts                           # Sentry server/edge registration
│   ├── instrumentation-client.ts                    # Sentry browser init
│   ├── env.ts                                       # Zod-validated process.env; crashes at boot if anything is missing
│   │
│   ├── app/
│   │   ├── layout.tsx                               # <html>, fonts, <Providers/>, <Toaster/>, global styles
│   │   ├── globals.css                              # Tailwind 4 @import, theme tokens, --accent variable
│   │   ├── robots.ts                                # Disallow everything except "/"
│   │   ├── page.tsx                                 # Signed out: landing page. Signed in: "Your Habitats" grid.
│   │   ├── login/page.tsx                           # Email magic link + "Continue with Google"
│   │   ├── login/check-email/page.tsx               # "Check your inbox" screen
│   │   ├── onboarding/page.tsx                      # First sign-in: name + avatar
│   │   ├── settings/page.tsx                        # Account: name, avatar, email prefs, export data, delete account
│   │   ├── new/page.tsx                             # Create-a-Habitat wizard
│   │   ├── join/[code]/page.tsx                     # Invite landing: Habitat preview, then "Join"
│   │   ├── h/[slug]/
│   │   │   ├── layout.tsx                           # Requires membership; <HabitatShell/> with nav built from installed modules
│   │   │   ├── page.tsx                             # Home: the Feed timeline + widgets column
│   │   │   ├── not-found.tsx                        # Same 404 for "doesn't exist" and "not a member" (no leaking)
│   │   │   ├── m/[moduleId]/[[...path]]/page.tsx    # Module host: looks up the module and renders its Page with the path
│   │   │   ├── members/page.tsx                     # Member list, roles, invite button
│   │   │   ├── members/[userId]/page.tsx            # A member's profile inside this Habitat (their posts, photos)
│   │   │   ├── library/page.tsx                     # Module library: browse, installed badges, "Propose"
│   │   │   ├── library/[moduleId]/page.tsx          # Module detail: description, what it stores, screenshots, propose
│   │   │   ├── proposals/page.tsx                   # Open and past votes
│   │   │   └── settings/page.tsx                    # Admin: name, emoji, accent, cover, governance, invites, module order
│   │   └── api/
│   │       ├── auth/[...all]/route.ts               # Better Auth handler
│   │       ├── me/route.ts                          # GET profile, PATCH name/avatar, DELETE account
│   │       ├── me/export/route.ts                   # GET: zip-free JSON export of everything you posted
│   │       ├── habitats/route.ts                    # GET my Habitats, POST create
│   │       ├── habitats/[habitatId]/route.ts        # GET, PATCH settings, DELETE (owner)
│   │       ├── habitats/[habitatId]/members/route.ts             # GET members
│   │       ├── habitats/[habitatId]/members/[userId]/route.ts    # PATCH role/nickname, DELETE (remove or leave)
│   │       ├── habitats/[habitatId]/invites/route.ts             # GET active invites, POST create
│   │       ├── habitats/[habitatId]/invites/[inviteId]/route.ts  # DELETE (revoke)
│   │       ├── invites/[code]/route.ts              # GET preview (name, emoji, member count), POST accept
│   │       ├── habitats/[habitatId]/modules/route.ts             # GET installed modules, PATCH order
│   │       ├── habitats/[habitatId]/modules/[moduleId]/route.ts  # PATCH settings (admins, or via proposal)
│   │       ├── habitats/[habitatId]/proposals/route.ts           # GET, POST propose
│   │       ├── habitats/[habitatId]/proposals/[proposalId]/route.ts       # GET, DELETE (withdraw by proposer)
│   │       ├── habitats/[habitatId]/proposals/[proposalId]/vote/route.ts  # PUT my vote
│   │       ├── habitats/[habitatId]/timeline/route.ts            # GET the merged home timeline (cursor paginated)
│   │       ├── habitats/[habitatId]/records/route.ts             # GET query, POST create (the module data API)
│   │       ├── habitats/[habitatId]/records/[recordId]/route.ts  # GET, PATCH, DELETE
│   │       ├── habitats/[habitatId]/records/[recordId]/comments/route.ts    # GET, POST
│   │       ├── habitats/[habitatId]/comments/[commentId]/route.ts           # PATCH, DELETE
│   │       ├── habitats/[habitatId]/records/[recordId]/reactions/route.ts   # PUT/DELETE { emoji }
│   │       ├── habitats/[habitatId]/records/[recordId]/pin/route.ts         # PUT/DELETE (admins)
│   │       ├── habitats/[habitatId]/uploads/route.ts             # POST: create media row + presigned PUT URLs
│   │       ├── habitats/[habitatId]/uploads/[mediaId]/route.ts   # POST complete (verify object exists, mark ready)
│   │       ├── media/[mediaId]/route.ts             # GET ?v=thumb|full: membership check, then 302 to a signed URL
│   │       ├── habitats/[habitatId]/realtime-token/route.ts      # GET Ably token scoped to this Habitat's channels
│   │       ├── habitats/[habitatId]/reports/route.ts             # POST report content; GET (admins)
│   │       ├── notifications/route.ts               # GET my notifications (all Habitats), cursor paginated
│   │       ├── notifications/read/route.ts          # POST mark read (ids or "all")
│   │       └── cron/
│   │           ├── proposals/route.ts               # Every 15 min: close expired proposals (H7)
│   │           ├── reminders/route.ts               # Hourly: event reminders (24h before), birthdays (09:00 UTC)
│   │           ├── digest/route.ts                  # Mondays: weekly email digest for people who opted in
│   │           └── purge/route.ts                   # Nightly: hard-delete module data removed >30 days ago (H9)
│   │
│   ├── components/
│   │   ├── ui/                                      # GENERATED by `pnpm dlx shadcn@latest add …` (list in Phase 0)
│   │   ├── Providers.tsx                            # "use client": QueryClientProvider, RealtimeProvider, ThemeProvider
│   │   ├── RealtimeProvider.tsx                     # "use client": one Ably client, subscribes to the current Habitat's channel
│   │   ├── HabitatShell.tsx                         # Top bar, side nav (desktop), bottom nav (mobile), sets --accent
│   │   ├── HabitatSwitcher.tsx                      # Dropdown of your Habitats + "New Habitat"
│   │   ├── ModuleNav.tsx                            # Nav items from installed modules, in the Habitat's order
│   │   ├── CreateHabitatWizard.tsx                  # "use client": name → emoji + colour → starting modules → invite
│   │   ├── HabitatCard.tsx                          # Tile on the "Your Habitats" grid
│   │   ├── InviteDialog.tsx                         # Create link, copy, share sheet, revoke
│   │   ├── MemberAvatar.tsx                         # Avatar + fallback initials, "former member" state
│   │   ├── MemberList.tsx                           # Members page list with role menu
│   │   ├── TimelineItem.tsx                         # Wraps any module's FeedCard with author, time, reactions, comments
│   │   ├── ReactionBar.tsx                          # The 6 reactions (H11), optimistic toggle
│   │   ├── CommentThread.tsx                        # Comments + one level of replies (H12)
│   │   ├── RichText.tsx                             # Plain text → links and @mentions as React nodes (no HTML injection)
│   │   ├── MentionInput.tsx                         # Textarea with @member autocomplete
│   │   ├── ImageUploader.tsx                        # "use client": pick → compress/strip EXIF → presign → PUT → complete
│   │   ├── MediaImage.tsx                           # <img> pointed at /api/media/[id] with thumb/full variants
│   │   ├── Lightbox.tsx                             # Full-screen photo viewer with swipe
│   │   ├── ModuleCard.tsx                           # Library tile: icon, name, tagline, installed/proposed badge
│   │   ├── ProposalCard.tsx                         # Vote buttons, yes/no bar, time left, outcome
│   │   ├── ProposeDialog.tsx                        # "Why should we add this?" + submit
│   │   ├── NotificationBell.tsx                     # Unread count (live via Ably) + dropdown list
│   │   ├── ReportButton.tsx                         # "Report to admins" menu item + dialog
│   │   ├── EmptyState.tsx                           # Friendly empty screens for every module
│   │   └── RelativeTime.tsx                         # "use client": "3h ago" that updates, full date on hover
│   │
│   ├── modules/                                     # ← THE MODULE SYSTEM. See §5.
│   │   ├── sdk/
│   │   │   ├── types.ts                             # HabitatModule, ModuleManifest, CollectionDef, PageProps, FeedCardProps
│   │   │   ├── fields.ts                            # Field spec types + compileFields(): field spec → Zod schema
│   │   │   ├── manifest-schema.ts                   # Zod schema every manifest must pass (code AND declarative AND AI)
│   │   │   ├── define.ts                            # defineModule() / defineCollection() helpers (type inference only)
│   │   │   ├── hooks.ts                             # "use client": useRecords, useRecord, useCreateRecord, useUpdateRecord,
│   │   │   │                                        #   useDeleteRecord, useLiveRecords. Wraps the records API + TanStack Query.
│   │   │   └── context.tsx                          # "use client": ModuleContext (habitat, me, role, module settings)
│   │   ├── registry.ts                              # All built-in modules by id; getModule(id); listLibrary()
│   │   ├── declarative/
│   │   │   ├── mdl-schema.ts                        # Zod schema for the Module Definition Language (JSON modules, §5.6)
│   │   │   ├── load.ts                              # Turns an MDL JSON document into a HabitatModule
│   │   │   ├── Renderer.tsx                         # Renders an MDL view tree with the SDK hooks
│   │   │   └── blocks/
│   │   │       ├── ListBlock.tsx                    # Repeating cards over a collection query
│   │   │       ├── FormBlock.tsx                    # Auto-generated form from collection fields
│   │   │       ├── FieldText.tsx                    # Renders one field value by type
│   │   │       ├── ToggleBlock.tsx                  # Checkbox bound to a boolean field
│   │   │       ├── CounterBlock.tsx                 # "12 of 30 done" style aggregates
│   │   │       ├── TabsBlock.tsx                    # Filtered tabs (e.g. To do / Done)
│   │   │       └── ImageGridBlock.tsx               # Grid over media fields
│   │   ├── feed/                                    # DEFAULT — posts with text + photos
│   │   │   ├── manifest.ts                          # collection "post" { text, mediaIds[] }, showInTimeline, notify on @mention
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # The home timeline (merges every module's timeline records)
│   │   │   ├── Composer.tsx                         # "What's happening?" + photos + @mentions
│   │   │   ├── FeedCard.tsx                         # A post in the timeline
│   │   │   └── PinnedPosts.tsx
│   │   ├── photos/                                  # DEFAULT — shared albums
│   │   │   ├── manifest.ts                          # "album" { title, description, coverMediaId? }, "photo" (parent album) { mediaId, caption? }
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Albums grid; path [albumId] → AlbumView
│   │   │   ├── AlbumView.tsx                        # Photo grid + upload + lightbox
│   │   │   ├── NewAlbumDialog.tsx
│   │   │   └── FeedCard.tsx                         # "Sam added 12 photos to Lisbon 2026"
│   │   ├── events/                                  # DEFAULT — plans and RSVPs
│   │   │   ├── manifest.ts                          # "event" { title, startsAt, endsAt?, location?, details?, coverMediaId? },
│   │   │   │                                        #   "rsvp" (parent event, unique per member) { status: going|maybe|no }
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Upcoming / Past tabs; path [eventId] → EventDetail
│   │   │   ├── EventDetail.tsx                      # Details, who's going, comments, add-to-calendar (.ics)
│   │   │   ├── EventForm.tsx
│   │   │   ├── RsvpButtons.tsx
│   │   │   ├── ics.ts                               # PURE: event → .ics text
│   │   │   ├── FeedCard.tsx
│   │   │   └── Widget.tsx                           # Next 3 events on the home page
│   │   ├── chat/                                    # DEFAULT — one group chat
│   │   │   ├── manifest.ts                          # "message" { text, mediaIds[] }, realtime: true, not in timeline
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Full-height chat view
│   │   │   ├── MessageList.tsx                      # Reverse infinite scroll, groups by author/time, live appends
│   │   │   ├── MessageInput.tsx                     # Enter to send, typing indicator via Ably presence
│   │   │   └── Widget.tsx                           # Last 3 messages + "Open chat"
│   │   ├── polls/                                   # LIBRARY
│   │   │   ├── manifest.ts                          # "poll" { question, options[], multiple, closesAt? }, "vote" (parent poll, unique per member) { choices[] }
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx
│   │   │   ├── PollForm.tsx
│   │   │   ├── PollView.tsx                         # Vote, then see results bars
│   │   │   ├── tally.ts                             # PURE: votes → counts/percentages
│   │   │   └── FeedCard.tsx                         # The poll itself, votable inline
│   │   ├── birthdays/                               # LIBRARY
│   │   │   ├── manifest.ts                          # "birthday" (unique per member) { month, day, year? }, notify on the day
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Calendar list + "Add mine"
│   │   │   ├── upcoming.ts                          # PURE: next birthdays from a date, handles Feb 29
│   │   │   └── Widget.tsx                           # "Jo's birthday is in 3 days 🎂"
│   │   ├── recommendations/                         # LIBRARY
│   │   │   ├── manifest.ts                          # "rec" { kind: book|film|tv|music|place|game|other, title, link?, note?, rating 1–5 }
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Filter by kind, sort by newest / most ❤️
│   │   │   ├── RecForm.tsx
│   │   │   └── FeedCard.tsx
│   │   ├── wishlist/                                # LIBRARY
│   │   │   ├── manifest.ts                          # "wish" { title, link?, price?, note? },
│   │   │   │                                        #   "claim" (parent wish, unique per parent, hiddenFrom: parent-author) {}
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Tabs per member; you never see claims on your own wishes
│   │   │   ├── WishForm.tsx
│   │   │   └── WishCard.tsx
│   │   ├── split-costs/                             # LIBRARY
│   │   │   ├── manifest.ts                          # "expense" { description, amountMinor, currency, paidBy, splitAmong[] },
│   │   │   │                                        #   "settlement" { from, to, amountMinor, currency }
│   │   │   ├── index.ts
│   │   │   ├── Page.tsx                             # Balances, "Settle up", history
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── settle.ts                            # PURE: balances + fewest transfers (integer minor units only)
│   │   │   └── Widget.tsx                           # "You owe Sam £12.50"
│   │   └── bucket-list/                             # LIBRARY — the first DECLARATIVE module (proves the AI format)
│   │       └── module.json                          # MDL: "idea" { title, details?, done } + list/tabs/form/counter views
│   │
│   ├── db/
│   │   ├── index.ts                                 # postgres.js client + drizzle instance (singleton)
│   │   └── schema.ts                                # All tables (§4), enums, indexes
│   │
│   ├── emails/                                      # React Email templates
│   │   ├── Layout.tsx                               # Shared wrapper: logo, footer, unsubscribe link
│   │   ├── MagicLinkEmail.tsx
│   │   ├── InviteEmail.tsx                          # "Rich invited you to The Lads' Habitat"
│   │   ├── ProposalEmail.tsx                        # "Vote: add Polls to your Habitat?"
│   │   ├── EventReminderEmail.tsx
│   │   └── DigestEmail.tsx                          # Weekly: N new posts, upcoming events, open votes
│   │
│   └── lib/
│       ├── auth.ts                                  # Better Auth server config (magic link, Google, drizzle adapter, rate limit)
│       ├── auth-client.ts                           # Better Auth React client
│       ├── session.ts                               # requireUser(), requireMember(habitatId, minRole), getHabitatBySlugForUser()
│       ├── permissions.ts                           # PURE: role matrix (H4) + collection permission checks (§5.3)
│       ├── governance.ts                            # PURE: decide(proposal, votes, memberCount, mode, now) → open|passed|rejected (H7, H8)
│       ├── habitats.ts                              # DB: createHabitat(), updateHabitat(), deleteHabitat(), transferOwnership()
│       ├── members.ts                               # DB: listMembers(), changeRole(), removeMember(), leave()
│       ├── invites.ts                               # DB: createInvite(), previewInvite(), acceptInvite() (cap + expiry + uses in one tx)
│       ├── invite-code.ts                           # PURE: generate 10-char base32 code, normalise input, hash
│       ├── slug.ts                                  # PURE: name → unique-able slug ("The Lads!" → "the-lads")
│       ├── installed-modules.ts                     # DB: install(), uninstall() (soft, H9), reorder(), settings
│       ├── proposals.ts                             # DB: propose(), vote(), withdraw(), closeExpired(), applyPassed()
│       ├── records.ts                               # DB: the module data service: create/get/query/update/delete with validation
│       ├── record-query.ts                          # PURE: safe query spec (filters on declared fields) → parameterised SQL
│       ├── timeline.ts                              # DB: merged home timeline across installed modules' timeline collections
│       ├── interactions.ts                          # DB: comments, replies, reactions, pins
│       ├── mentions.ts                              # PURE: extract @mentions from text against the member list
│       ├── notifications.ts                         # DB: notify() inside the caller's tx, list(), markRead(); fan-out rules
│       ├── media.ts                                 # DB + R2: createUpload(), completeUpload(), signedUrl(); size/MIME limits
│       ├── storage.ts                               # S3Client for R2, presign PUT/GET helpers
│       ├── realtime.ts                              # Ably REST: publish(habitatId, event), createTokenRequest(user, habitat)
│       ├── email.ts                                 # Resend client; in dev/test writes to the console / `email_outbox` table
│       ├── reports.ts                               # DB: report(), listReports(), resolve()
│       ├── audit.ts                                 # DB: log(habitatId, actor, action, details): visible to admins
│       ├── account.ts                               # DB: exportMyData(), deleteAccount()
│       ├── rate-limit.ts                            # Postgres fixed-window limiter (same approach as Brock)
│       ├── cron.ts                                  # assertCronRequest(): checks the CRON_SECRET bearer token
│       ├── validation.ts                            # Zod request bodies for every route
│       ├── errors.ts                                # Typed domain errors → HTTP status mapping, one JSON error shape
│       └── api.ts                                   # route(handler) wrapper: auth, Origin check, Zod parse, error mapping
│
├── tests/
│   ├── unit/
│   │   ├── permissions.test.ts
│   │   ├── governance.test.ts                       # Every row of H7/H8, including 2-member and 150-member groups
│   │   ├── fields.test.ts                           # Every field type compiles and rejects bad input
│   │   ├── manifest-schema.test.ts                  # Every built-in manifest + bucket-list/module.json passes
│   │   ├── mdl-schema.test.ts                       # Good and bad MDL documents
│   │   ├── record-query.test.ts                     # Undeclared fields rejected, values always parameterised
│   │   ├── invite-code.test.ts
│   │   ├── slug.test.ts
│   │   ├── mentions.test.ts
│   │   ├── tally.test.ts                            # polls
│   │   ├── upcoming.test.ts                         # birthdays incl. Feb 29 in non-leap years
│   │   ├── settle.test.ts                           # split-costs: sums to zero, minimal transfers, rounding
│   │   └── ics.test.ts                              # events
│   ├── integration/
│   │   ├── setup.ts                                 # Migrate + truncate the test DB between tests; factories for users/habitats
│   │   ├── factories.ts                             # makeUser(), makeHabitat({ members: n }), makeRecord()
│   │   ├── habitats.test.ts
│   │   ├── invites.test.ts                          # Expiry, max uses, member cap, concurrent accepts at cap-1
│   │   ├── proposals.test.ts                        # Early pass/fail, window close, one open per module, concurrent votes
│   │   ├── records.test.ts                          # Validation, permissions, unique-per-member, hiddenFrom
│   │   ├── isolation.test.ts                        # ★ Habitat A can never read/write Habitat B's anything, via every route
│   │   ├── interactions.test.ts
│   │   ├── notifications.test.ts
│   │   └── uninstall.test.ts                        # Soft hide, reinstall restores, purge after 30 days
│   └── e2e/
│       ├── fixtures.ts                              # Signs users in by reading magic links from `email_outbox`
│       ├── create-and-join.spec.ts                  # A creates a Habitat → invites → B joins in a second browser context
│       ├── feed.spec.ts                             # Post with a photo, react, comment, @mention → notification
│       └── module-vote.spec.ts                      # A proposes Polls → B votes yes → Polls appears in the nav for both
│
├── .env.example                                     # Every env var, documented, no secrets (§9)
├── .gitignore
├── .nvmrc                                           # 24
├── .prettierrc
├── .prettierignore
├── components.json                                  # shadcn/ui config
├── docker-compose.yml                               # postgres:16 for dev (5432) and test (5433)
├── drizzle.config.ts
├── eslint.config.mjs                                # + rule: no dangerouslySetInnerHTML anywhere
├── next.config.ts                                   # Sentry wrapper, security headers (CSP, X-Robots-Tag: noindex on /h/*)
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml                                   # GENERATED by pnpm install
├── postcss.config.mjs
├── README.md                                        # Setup, scripts, deploy, how to write a module
├── scripts/
│   └── seed.ts                                      # `pnpm db:seed`: demo Habitat with 5 members, posts, an event, an open vote
├── docs/
│   └── writing-a-module.md                          # The module contract (§5) as a how-to, with a worked example
├── tsconfig.json                                    # strict, path alias "@/*" → "src/*"
├── vercel.json                                      # Cron schedules (§11, Phase 8)
└── vitest.config.ts                                 # two projects: unit, integration
```

That's **245 hand-written files**, plus generated output (`drizzle/`, `pnpm-lock.yaml`, `next-env.d.ts`, `src/components/ui/*`).

shadcn components to generate in Phase 0: `button card dialog input textarea label avatar dropdown-menu tabs sheet badge skeleton separator scroll-area tooltip popover checkbox radio-group select switch progress sonner`.

---

## 4. Data model (`src/db/schema.ts`)

All IDs are `uuid` (`gen_random_uuid()`) unless stated otherwise. All timestamps are `timestamptz`. **Every table that holds Habitat content has a `habitat_id` column**, and every query on it filters by a `habitat_id` taken from a verified membership, never from the client alone.

### 4.1 Auth tables (shape set by Better Auth)
`user` (id, name, email, email_verified, image, created_at, updated_at), `session`, `account`, `verification`. Generate them with `pnpm dlx @better-auth/cli generate` and paste them into `schema.ts`. Add two columns to `user`: `onboarded_at timestamptz null` and `email_prefs jsonb not null default '{"digest":true,"events":true,"proposals":true}'`.

### 4.2 Habitat tables

| Table | Columns | Constraints and indexes |
|---|---|---|
| `habitat` | id, slug, name (1–60), emoji, accent (hex), cover_media_id?, description?, governance (`majority`\|`unanimous`\|`admins`), vote_window_hours (default 48), member_cap (default 150, max 150), members_can_invite (default true), created_by → user, created_at, deleted_at? | `UNIQUE(slug)` |
| `membership` | habitat_id, user_id, role (`owner`\|`admin`\|`member`), nickname?, joined_at, left_at? | `PK(habitat_id, user_id)`, index `(user_id)`, partial unique `(habitat_id) WHERE role='owner' AND left_at IS NULL` |
| `invite` | id, habitat_id, code_hash (sha256), created_by, expires_at, max_uses?, uses (default 0), revoked_at?, created_at | `UNIQUE(code_hash)`, index `(habitat_id)` |
| `installed_module` | habitat_id, module_id (text, e.g. `polls`, later `custom:<uuid>`), version, position, settings jsonb, installed_at, removed_at?, installed_by_proposal_id? | `PK(habitat_id, module_id)` |
| `proposal` | id, habitat_id, kind (`install`\|`uninstall`\|`settings`\|`governance`), module_id?, payload jsonb, reason?, proposed_by, status (`open`\|`passed`\|`rejected`\|`withdrawn`), closes_at, decided_at?, created_at | Partial unique `(habitat_id, module_id) WHERE status='open'` (one open proposal per module, H6) |
| `proposal_vote` | proposal_id, user_id, vote (`yes`\|`no`), voted_at | `PK(proposal_id, user_id)` |

### 4.3 Module data tables (shared by every module)

| Table | Columns | Constraints and indexes |
|---|---|---|
| `record` | id, habitat_id, module_id, collection, author_id → user, parent_id? → record, data jsonb, unique_key?, pinned_at?, created_at, updated_at, deleted_at? | Index `(habitat_id, module_id, collection, created_at DESC)`, index `(parent_id)`, partial unique `(habitat_id, module_id, collection, unique_key) WHERE unique_key IS NOT NULL AND deleted_at IS NULL` |
| `comment` | id, habitat_id, record_id, parent_comment_id?, author_id, body (1–2000), created_at, edited_at?, deleted_at? | Index `(record_id, created_at)`. A check in the service ensures a reply's parent isn't itself a reply (H12). |
| `reaction` | habitat_id, record_id, user_id, emoji (enum of 6), created_at | `PK(record_id, user_id, emoji)` |
| `media` | id, habitat_id, uploader_id, key_full, key_thumb, mime (`image/jpeg`\|`image/webp`\|`image/png`), bytes, width, height, status (`pending`\|`ready`), created_at | Index `(habitat_id)`. Pending rows over 24 hours old are purged. |

Why one generic `record` table instead of a table per module: **AI-built modules can't run migrations**. If every built-in module already stores its data as validated JSONB documents, custom modules (declarative now, AI-built later) run on exactly the same rails, with no schema changes and no special cases. Friend groups produce little data (a busy Habitat makes thousands of records a year, not millions), so JSONB plus the indexes above is plenty.

### 4.4 Platform tables

| Table | Columns | Notes |
|---|---|---|
| `notification` | id, user_id, habitat_id, type, actor_id?, record_id?, proposal_id?, payload jsonb, read_at?, emailed_at?, created_at | Index `(user_id, read_at, created_at DESC)` |
| `report` | id, habitat_id, reporter_id, target_type (`record`\|`comment`\|`member`), target_id, reason, status (`open`\|`resolved`), created_at, resolved_by? | Only that Habitat's admins see reports. |
| `audit_log` | id, habitat_id, actor_id?, action, details jsonb, created_at | Shown to admins: "Sam removed Jo", "Polls installed by vote". |
| `rate_limit` | key, window_start, count | `PK(key, window_start)`, same approach as Brock |
| `email_outbox` | id, to, subject, html, created_at | **Dev/test only** (`EMAIL_TRANSPORT=outbox`). E2E reads magic links from it. |

That makes 19 tables (4 auth + 15 app).

---

## 5. The module system (the heart of Habitat)

### 5.1 What a module is
A module is a **manifest** (data, permissions, notifications) plus **UI** (a page, and optionally a timeline card and a home widget). Built-in modules are TypeScript in `src/modules/<id>/`. Declarative modules are a single `module.json` in the Module Definition Language (§5.6). In both cases the platform reads the manifest and does all storage, permission checks, validation, notifications and realtime itself. **Modules never touch the database directly.** That rule is what makes modules safe to swap, vote on and, later, generate with AI.

### 5.2 The contract (`src/modules/sdk/types.ts`)
This is a specification of the shape to build, not finished code:

```ts
interface ModuleManifest {
  id: string;                 // "polls"  (kebab-case, unique; custom modules: "custom:<uuid>")
  name: string;               // "Polls"
  tagline: string;            // "Settle it with a vote"
  description: string;        // Shown on the library detail page
  icon: string;               // lucide icon name, e.g. "bar-chart-3"
  category: 'social' | 'plans' | 'fun' | 'practical';
  version: number;            // Bump when collections change; the loader migrates `data` if needed
  isDefault?: boolean;        // H5: installed on Habitat creation
  collections: Record<string, CollectionDef>;
  settings?: FieldSpec;       // Per-Habitat settings the group can change (e.g. "currency": GBP)
  nav?: { label: string; order: number } | false; // false = widget/timeline only
}

interface CollectionDef {
  fields: FieldSpec;                       // compiled to Zod by fields.ts
  parent?: string;                         // e.g. rsvp.parent = "event"
  unique?: 'per-member' | 'per-parent' | 'per-member-per-parent';
  showInTimeline?: boolean;                // appears on the Habitat home page
  realtime?: boolean;                      // publish create/update/delete over Ably
  permissions?: {
    create?: 'member' | 'admin';           // default member
    update?: 'author' | 'admin' | 'author-or-admin';  // default author
    delete?: 'author' | 'admin' | 'author-or-admin';  // default author-or-admin
    hiddenFrom?: 'parent-author';          // wishlist claims
  };
  notify?: Array<{ on: 'create'; to: 'all-members' | 'parent-author' | 'mentioned'; text: string }>;
  limits?: { perMemberPerDay?: number; maxPerHabitat?: number };
}

type FieldSpec = Record<string, Field>;
type Field =
  | { type: 'text'; max: number; required?: boolean }
  | { type: 'longtext'; max: number; required?: boolean }
  | { type: 'integer' | 'number'; min?: number; max?: number; required?: boolean }
  | { type: 'boolean'; default?: boolean }
  | { type: 'date' | 'datetime'; required?: boolean }
  | { type: 'enum'; options: string[]; required?: boolean }
  | { type: 'url'; required?: boolean }
  | { type: 'media'; required?: boolean }                    // one media id (must be this Habitat's)
  | { type: 'media-list'; max: number }
  | { type: 'member'; required?: boolean }                   // a user id (must be a member)
  | { type: 'member-list'; max?: number }
  | { type: 'text-list'; maxItems: number; maxLength: number }
  | { type: 'money' };                                       // { amountMinor: int, currency: ISO 4217 }

interface HabitatModule {
  manifest: ModuleManifest;
  Page?: React.ComponentType<{ path: string[] }>;            // rendered at /h/[slug]/m/[id]/[...path]
  FeedCard?: React.ComponentType<{ record: RecordDTO }>;     // for showInTimeline collections
  Widget?: React.ComponentType;                              // home page sidebar
}
```

### 5.3 What the platform guarantees for every module
1. **Validation.** On create and update, `records.ts` compiles the collection's `fields` to Zod and rejects anything invalid with `422`. `media` and `member` fields are also checked against this Habitat.
2. **Permissions.** `permissions.ts` checks the caller's membership and role, plus authorship for update and delete. `hiddenFrom: 'parent-author'` filters records out of every read for that user, timeline included.
3. **Uniqueness.** `unique` becomes `unique_key` (e.g. `per-member-per-parent` → `"<parentId>:<userId>"`). The database index enforces it, and a repeat create becomes an update (an RSVP change, a re-vote).
4. **Installed check.** Writes to a module that isn't installed (or was removed, H9) return `404 module_not_installed`. Reads of removed modules return nothing.
5. **Interactions for free.** Any record can have comments, reactions and a pin. Modules don't define these.
6. **Notifications.** The `notify` rules run inside the same transaction as the write.
7. **Realtime.** For `realtime: true` collections, after commit, `realtime.ts` publishes `{ type: 'record.created', moduleId, collection, id }` to `habitat:<id>`. Clients refetch or append.
8. **Limits.** `limits` plus a global cap of 60 writes per member per minute (via `rate-limit.ts`).

### 5.4 Querying (`record-query.ts`)
`GET /api/habitats/:id/records?module=events&collection=event&where[startsAt][gte]=2026-10-16T00:00:00Z&order=startsAt:asc&limit=20&cursor=…`

- Allowed operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, plus `parentId`, `authorId` and `pinned`.
- Field names must be declared fields in the collection, otherwise `400 bad_query`. Values are always bound parameters, cast by field type (`(data->>'startsAt')::timestamptz`).
- `limit` is clamped to 1–100. The cursor is an opaque base64 of `(sortValue, id)`.

### 5.5 The timeline (`timeline.ts`)
The home page shows records from every installed module's `showInTimeline` collections, newest first, with pinned records on top (H10). It's one query: `WHERE habitat_id=$1 AND (module_id, collection) IN (…installed timeline collections…) AND deleted_at IS NULL`. Each item renders through its module's `FeedCard`, wrapped in `TimelineItem` (author, time, reactions, comments). A module without a `FeedCard` gets a generic card.

### 5.6 Declarative modules: the Module Definition Language (MDL)
MDL is JSON: `{ manifest: ModuleManifest (without code), views: { main: ViewNode } }`. A `ViewNode` is one of a fixed set of blocks (`list`, `form`, `tabs`, `toggle`, `counter`, `image-grid`, `stack`, `text`), and each block binds to a collection, a query and field names. `Renderer.tsx` turns it into React using the same SDK hooks the code modules use.

- **No HTML, no JavaScript, no expressions** beyond simple filters in the query spec. Everything is validated by `mdl-schema.ts`.
- **Bucket List** ships in v1 as `bucket-list/module.json`. It is the proof that a module can be built with zero code, and it's the exact format the AI builder in §13 will output.

### 5.7 The module library in v1

| Module | Default? | What it does | Collections |
|---|---|---|---|
| **Feed** | ✅ | Posts with text, up to 10 photos and @mentions. Pinned posts. The home timeline. | `post` |
| **Photos** | ✅ | Shared albums anyone can add to, with a lightbox | `album`, `photo` |
| **Events** | ✅ | Plans with going/maybe/no RSVPs, reminders and an .ics download | `event`, `rsvp` |
| **Chat** | ✅ | One live group chat with typing indicators | `message` |
| **Polls** | | Quick votes, single or multiple choice, optional closing time | `poll`, `vote` |
| **Birthdays** | | Everyone adds theirs. Reminders on the day and a countdown widget. | `birthday` |
| **Recommendations** | | Books, films, places and more, with ratings | `rec` |
| **Wishlist** | | Gift ideas. Friends can claim gifts secretly, so the owner never sees claims. | `wish`, `claim` |
| **Split Costs** | | Who paid what on a trip, balances, and the fewest transfers to settle up | `expense`, `settlement` |
| **Bucket List** | | Things to do together, ticked off as you go. Declarative (MDL). | `idea` |

**Core, not modules:** Members, Notifications, Library, Proposals and Settings.

---

## 6. Core logic (pure functions; write these first and test them hardest)

| File | Function | Rule |
|---|---|---|
| `lib/governance.ts` | `decide({ mode, yes, no, memberCount, closesAt, now, adminVoted })` | H7 and H8, exactly as written. Returns `'open' \| 'passed' \| 'rejected'`. Member count is taken **at decision time**, and votes from people who have left are not counted. |
| `lib/permissions.ts` | `can(role, action)`, `canWriteRecord(member, record, collectionDef, op)` | The H4 matrix and §5.3 point 2 |
| `modules/sdk/fields.ts` | `compileFields(spec) → ZodObject` | Unknown keys are stripped, `text` is trimmed, `max` is enforced. `money` is an integer number of minor units. |
| `lib/record-query.ts` | `buildQuery(spec, collectionDef) → SQL` | §5.4 |
| `lib/invite-code.ts` | `newCode()`, `normalise(input)`, `hash(code)` | Crockford base32 with no ambiguous characters. Normalising uppercases and maps O→0 and I/L→1. |
| `lib/slug.ts` | `slugify(name)`, `withSuffix(slug, n)` | Lowercase a-z0-9 and hyphens, 3–40 characters, adds `-2`, `-3` and so on when a slug is taken |
| `lib/mentions.ts` | `extractMentions(text, members)` | `@Name` matches a member's nickname or name (case-insensitive, longest match wins) |
| `modules/polls/tally.ts` | `tally(options, votes)` | Percentages round so they sum to 100 |
| `modules/birthdays/upcoming.ts` | `upcoming(birthdays, today, n)` | Feb 29 birthdays fall on Feb 28 in non-leap years |
| `modules/split-costs/settle.ts` | `balances(expenses, settlements)`, `transfers(balances)` | Integers only. The remainder from a split goes to the first people in the split, in a stable order. Greedy largest-creditor/largest-debtor matching. |
| `modules/events/ics.ts` | `toIcs(event, habitatName)` | Valid RFC 5545 with escaped text |

---

## 7. API contract

Every route goes through `lib/api.ts`, which does the following:
1. Resolves the session (`401 unauthenticated`).
2. For `/habitats/:habitatId/*`, loads the caller's membership (`404 not_found` if they aren't a member. It's never 403, so outsiders can't tell whether a Habitat exists).
3. For writes, checks `Origin` matches `NEXT_PUBLIC_APP_URL` (`403 bad_origin`).
4. Parses the body with the route's Zod schema (`422 invalid` with field errors).
5. Maps domain errors to statuses.

**Error shape (all routes):** `{ "error": { "code": "proposal_already_open", "message": "There's already a vote open for Polls." } }`

Key routes, with the rest following the same pattern:

### `POST /api/habitats`
Body `{ name, emoji, accent, modules: string[] }`, where `modules` is a subset of the defaults. Creates the habitat, the owner membership and the installed modules in one transaction. → `201 { habitat: { id, slug } }`

### `POST /api/invites/:code`
Accepts an invite. In one transaction it locks the invite row and the habitat row, then checks expiry, revocation, uses and member cap. → `200 { slug }`. Errors: `410 invite_expired`, `409 habitat_full`, `409 already_member`.

### `POST /api/habitats/:id/proposals`
Body `{ kind: 'install', moduleId: 'polls', reason?: string }`. Checks that the module exists in the library and isn't already installed (or is installed, for `uninstall`), and that no proposal for it is open. Records the proposer's own yes vote, then runs `decide()`. In `admins` mode, an admin's proposal passes at once. Notifies all members. → `201 { proposal }`

### `PUT /api/habitats/:id/proposals/:pid/vote`
Body `{ vote: 'yes' | 'no' }`. Locks the proposal row (`FOR UPDATE`), upserts the vote and runs `decide()`. If the result is `passed`, `applyPassed()` installs or uninstalls the module **in the same transaction** and writes the audit log. Publishes `proposal.decided`. → `200 { proposal, status }`. Errors: `409 proposal_closed`.

### `POST /api/habitats/:id/records`
Body `{ module, collection, parentId?, data }` → `201 { record }`. See §5.3 for every check.

### `GET /api/habitats/:id/timeline?cursor=…`
→ `200 { items: RecordDTO[], nextCursor }`, where each item includes `author`, `reactionCounts`, `myReactions`, `commentCount` and `pinned`.

### `POST /api/habitats/:id/uploads`
Body `{ files: [{ mime, bytes, width, height }] }`, with at most 10 files of up to 10 MB each. → `{ uploads: [{ mediaId, putFull, putThumb }] }`. URLs expire in 5 minutes. Then `POST /uploads/:mediaId` checks both objects exist with `HeadObject` and sets `ready`.

### `GET /api/media/:mediaId?v=thumb|full`
Membership check, then `302` to a signed GET URL valid for 1 hour, with `Cache-Control: private, max-age=3000`.

**RecordDTO:** `{ id, module, collection, parentId, author: { id, name, image, nickname }, data, createdAt, updatedAt, pinned, reactionCounts, myReactions, commentCount }`

---

## 8. Pages and UX

- **Landing (`/`, signed out):** a headline ("Your friends. Your rules. Your Habitat."), three illustrated points (private, modular, decided together) and a "Start your Habitat" button.
- **Your Habitats (`/`, signed in):** a grid of `HabitatCard`s showing emoji, name, accent colour, unread count and member faces, plus a "New Habitat" tile.
- **Create wizard (`/new`):**
  1. Name.
  2. Emoji and accent colour, with a live preview of the shell.
  3. Starting modules, with the defaults ticked and the library shown as "add later by vote".
  4. Invite link and share sheet.
- **Habitat shell:** your Habitat's emoji, name and accent colour everywhere, because it should feel like *your* place.
  - Desktop: left nav with installed modules, then Members, Library and Votes (with a badge for open votes).
  - Mobile: bottom nav with the first 4 modules plus "More".
  - Top bar: Habitat switcher and notification bell.
- **Home:** the composer, pinned posts, then the timeline. Widgets (Events, Birthdays, Chat, Split Costs) sit in the right column on desktop, or a horizontal strip above the timeline on mobile.
- **Library:** module cards grouped by category. An installed module shows "Installed ✓". One being voted on shows "Vote open: 3/5 yes". Otherwise the card shows "Propose". The detail page says plainly what data the module stores and who can see it.
- **Votes:** each proposal shows yes/no bars, the time left, who has voted, and the rule in plain English ("Passes when 4 of 6 say yes").
- **Empty states everywhere:** every module has a friendly first-use screen with one clear action.
- **Accessibility:** use Radix primitives, make everything keyboard reachable, give every image alt text (captions or "Photo by Sam"), respect `prefers-reduced-motion`, and meet AA contrast. Each accent colour is checked for contrast, and if it fails, the picker darkens it.

---

## 9. Environment variables (`.env.example`)

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgres://habitat:habitat@localhost:5432/habitat
TEST_DATABASE_URL=postgres://habitat:habitat@localhost:5433/habitat_test

# Better Auth
BETTER_AUTH_SECRET=                 # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
EMAIL_TRANSPORT=console             # console | outbox (tests) | resend (production)
RESEND_API_KEY=
EMAIL_FROM="Habitat <hello@yourdomain.com>"

# Storage (Cloudflare R2, private bucket, CORS allows PUT from NEXT_PUBLIC_APP_URL)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=habitat-media

# Realtime
ABLY_API_KEY=                       # server only; browsers get scoped tokens

# Cron (Vercel sends it as a Bearer token)
CRON_SECRET=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# After v1: AI module builder (§13)
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-opus-5-5
```

`src/env.ts` parses all of these with Zod at startup. In production it requires `EMAIL_TRANSPORT=resend` and refuses `outbox`.

---

## 10. `package.json` scripts

| Script | Command |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `vercel-build` | migrate on production deploys only (same as Brock), then `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `format` | `prettier --write .` |
| `typecheck` | `tsc --noEmit` |
| `db:up` | `docker compose up -d` |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:studio` | `drizzle-kit studio` |
| `db:seed` | `tsx scripts/seed.ts` |
| `email:dev` | `email dev --dir src/emails` (React Email preview server) |
| `test` | `vitest run --project unit` |
| `test:integration` | `vitest run --project integration` |
| `test:e2e` | `playwright test` |

---

## 11. Build order

Finish each phase, meet its acceptance criteria and commit before starting the next.

### Phase 0: Scaffold (≈2 hrs)
1. `pnpm create next-app@latest habitat --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`
2. Add `.nvmrc`, `.prettierrc`, `.prettierignore`, `.env.example`, `docker-compose.yml` and `vercel.json` (with no crons yet), and set `strict` in `tsconfig.json`.
3. Install the dependencies:
   - Runtime: `drizzle-orm postgres better-auth zod @tanstack/react-query date-fns lucide-react sonner ably resend @react-email/components @aws-sdk/client-s3 @aws-sdk/s3-request-presigner browser-image-compression @sentry/nextjs`
   - Dev: `drizzle-kit vitest @vitest/coverage-v8 @playwright/test prettier tsx react-email`
4. Run `pnpm dlx shadcn@latest init`, then add the components listed in §3.
5. Add the scripts from §10 and `src/env.ts`.

✅ `pnpm dev` serves the default page, and `pnpm lint`, `pnpm typecheck` and `pnpm db:up` all succeed.

### Phase 1: Pure logic + unit tests (≈4 hrs)
Files: `lib/governance.ts`, `lib/permissions.ts`, `lib/invite-code.ts`, `lib/slug.ts`, `lib/mentions.ts`, `lib/record-query.ts`, `modules/sdk/types.ts`, `modules/sdk/fields.ts`, `modules/sdk/manifest-schema.ts`, `modules/sdk/define.ts`, `vitest.config.ts` and the matching `tests/unit/*`.

`governance.test.ts` must cover:
- in a 2-member group, one yes stays open and two yeses pass
- in a 6-member group, 4 yeses pass early and 3 nos fail early
- at window close, 2 yes / 1 no out of 9 members passes (turnout ⅓) and 2 yes / 0 no out of 9 fails (turnout below ⅓)
- `unanimous` fails on any single no
- in `admins` mode, an admin's vote decides immediately and a member's vote changes nothing
- a member leaving mid-vote changes the threshold

`record-query.test.ts` must prove that an undeclared field, an injection-shaped value and a bad operator are each rejected or bound as parameters.

✅ `pnpm test` is green and coverage on these files is ≥ 95%.

### Phase 2: Database (≈2 hrs)
Files: `db/schema.ts`, `db/index.ts` and `drizzle.config.ts`, then `pnpm db:generate` → `drizzle/0000_initial.sql`.

✅ `pnpm db:migrate` succeeds on a fresh database and `db:studio` shows 19 tables. These inserts must fail:
- a second open proposal for the same module
- a second owner
- a duplicate `unique_key`

### Phase 3: Auth + onboarding (≈3 hrs)
1. Create a Google OAuth client with callback `http://localhost:3000/api/auth/callback/google`.
2. Files: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `lib/session.ts`, `lib/email.ts`, `emails/Layout.tsx`, `emails/MagicLinkEmail.tsx`, `app/login/*`, `app/onboarding/page.tsx`, `app/api/me/route.ts` and `src/proxy.ts`.
3. With `EMAIL_TRANSPORT=console`, the magic link is printed in the terminal.

✅ You can sign in with a magic link and with Google. A new user goes to `/onboarding` and then `/`. Signing out works. Visiting `/h/anything` while signed out redirects to `/login`.

### Phase 4: Habitats, members, invites (≈5 hrs)
Files: `lib/habitats.ts`, `lib/members.ts`, `lib/invites.ts`, `lib/audit.ts`, `lib/api.ts`, `lib/errors.ts`, `lib/validation.ts`, `lib/rate-limit.ts`, the habitat, member and invite routes, `app/new/page.tsx`, `components/CreateHabitatWizard.tsx`, `app/join/[code]/page.tsx`, `components/InviteDialog.tsx`, `app/h/[slug]/layout.tsx` (with a placeholder nav), `app/h/[slug]/members/*`, `components/MemberList.tsx`, `components/MemberAvatar.tsx`, `components/HabitatCard.tsx`, `components/HabitatSwitcher.tsx`, `app/page.tsx`, `tests/integration/setup.ts`, `tests/integration/factories.ts`, `tests/integration/habitats.test.ts` and `tests/integration/invites.test.ts`.

`invites.test.ts` must cover:
- an expired invite → `410`
- a revoked invite → `410`
- `max_uses` reached → `410`
- **concurrency**: 5 parallel accepts when 1 seat is left gives exactly 1 success
- accepting twice → `409 already_member`

✅ In two browsers (or one normal and one private window), user A creates a Habitat and user B joins by link and appears in Members. A non-member visiting the slug gets a 404.

### Phase 5: Module runtime (≈7 hrs). This is the core.
Files: `modules/registry.ts`, `modules/sdk/hooks.ts`, `modules/sdk/context.tsx`, `lib/installed-modules.ts`, `lib/records.ts`, `lib/timeline.ts`, `lib/interactions.ts`, `lib/notifications.ts` (writes only), the `records`, `comments`, `reactions`, `pin`, `timeline` and `modules` routes, `app/h/[slug]/m/[moduleId]/[[...path]]/page.tsx`, `components/HabitatShell.tsx`, `components/ModuleNav.tsx`, `components/TimelineItem.tsx`, `components/ReactionBar.tsx`, `components/CommentThread.tsx`, `components/RichText.tsx`, `components/Providers.tsx`, `components/EmptyState.tsx`, `components/RelativeTime.tsx`, `tests/integration/records.test.ts`, `tests/integration/interactions.test.ts` and `tests/integration/isolation.test.ts`.

`isolation.test.ts` creates Habitats A and B and, **for every route under `/api/habitats/:id/*` and `/api/media/*`**, asserts that a member of A using B's IDs (habitat, record, comment, media) gets `404`. It also asserts that a record ID from B passed as `parentId` in A is rejected. Add a route to this test whenever you add a route.

✅ A throwaway test module (registered only in tests) can create, query, update and delete records with validation and permissions enforced, and comments and reactions work on its records.

### Phase 6: Default modules (≈12 hrs)
1. **Feed** (3 hrs): `modules/feed/*`, `components/MentionInput.tsx` and `lib/mentions.ts` wired to `notify`. The home `app/h/[slug]/page.tsx` renders the Feed page plus widgets.
2. **Photos** (4 hrs): `lib/storage.ts`, `lib/media.ts`, the uploads and media routes, `components/ImageUploader.tsx`, `MediaImage.tsx`, `Lightbox.tsx` and `modules/photos/*`. Create the R2 bucket (private) and set its CORS rule to allow `PUT` from your app URL.
3. **Events** (2.5 hrs): `modules/events/*` and `tests/unit/ics.test.ts`.
4. **Chat** (2.5 hrs): `lib/realtime.ts`, the realtime-token route, `components/RealtimeProvider.tsx` and `modules/chat/*`. Ably tokens grant `subscribe` + `presence` on `habitat:<id>` only.

✅ On a 375px phone viewport:
- post with 3 photos
- check the uploaded file has no EXIF GPS data (`exiftool` on the downloaded original)
- react and comment
- create an event and RSVP from a second account
- chat live between two browsers with under a second of latency

### Phase 7: Governance and the library (≈5 hrs)
Files: `lib/proposals.ts`, the proposal and vote routes, `app/h/[slug]/library/*`, `app/h/[slug]/proposals/page.tsx`, `components/ModuleCard.tsx`, `ProposalCard.tsx`, `ProposeDialog.tsx`, `app/h/[slug]/settings/page.tsx` (governance, module order, Habitat look), `app/api/cron/proposals/route.ts`, `lib/cron.ts`, `tests/integration/proposals.test.ts` and `tests/integration/uninstall.test.ts`.

`proposals.test.ts` must cover:
- **concurrency**: 6 members vote yes in parallel and the module is installed exactly once
- a second proposal for the same module → `409`
- cron closes an expired proposal using the window-close rule
- an uninstall vote hides the data, and reinstalling restores it

✅ In a 3-person Habitat, A proposes Polls (a stub module is fine until Phase 9) and B votes yes. Polls appears in everyone's nav without a refresh, via a `proposal.decided` realtime event.

### Phase 8: Notifications, email, cron (≈4 hrs)
Files: the rest of `lib/notifications.ts`, `app/api/notifications/*`, `components/NotificationBell.tsx`, `emails/InviteEmail.tsx`, `ProposalEmail.tsx`, `EventReminderEmail.tsx` and `DigestEmail.tsx`, `app/api/cron/reminders`, `digest` and `purge`, `tests/integration/notifications.test.ts`, and the cron entries in `vercel.json`:

| Cron route | Schedule |
|---|---|
| `/api/cron/proposals` | `*/15 * * * *` |
| `/api/cron/reminders` | `0 * * * *` |
| `/api/cron/digest` | `0 8 * * 1` |
| `/api/cron/purge` | `30 3 * * *` |

✅ An @mention notifies only the person mentioned, and live. A new proposal emails members who opted in. Cron routes return `401` without `CRON_SECRET`. The digest renders in `pnpm email:dev`.

### Phase 9: Library modules (≈8 hrs)
Build `modules/polls/*`, `birthdays/*`, `recommendations/*`, `wishlist/*` and `split-costs/*`, with `tally.test.ts`, `upcoming.test.ts` and `settle.test.ts`.

✅ Each module installs via a vote, works on mobile and has an empty state. On Wishlist, the owner never sees claims on their own wishes, including through the API and the timeline (add this to `records.test.ts`). On Split Costs, balances always sum to 0 over 1,000 randomised expense sets.

### Phase 10: Declarative modules (≈5 hrs)
Files: `modules/declarative/*` and `modules/bucket-list/module.json`. Register `bucket-list` in `registry.ts` via `load.ts`. Then add `tests/unit/mdl-schema.test.ts` and `docs/writing-a-module.md`.

✅ Bucket List installs by vote and works exactly like a code module (comments, reactions and timeline included). A malformed `module.json` fails `pnpm test` with a readable error naming the bad path.

### Phase 11: Hardening (≈4 hrs)
Files: `lib/reports.ts`, the reports route, `components/ReportButton.tsx`, `lib/account.ts`, `app/api/me/export/route.ts`, `app/settings/page.tsx`, `app/robots.ts`, security headers in `next.config.ts`, the Sentry files, and `public/manifest.webmanifest` and icons. Work through every item in §12.

✅ Every item in §12 is ticked. Lighthouse on the Habitat home page (mobile) scores ≥ 90 for performance and accessibility.

### Phase 12: E2E, CI, deploy (≈4 hrs)
1. `playwright.config.ts` starts `pnpm build && pnpm start` with `EMAIL_TRANSPORT=outbox` against the test database. `tests/e2e/fixtures.ts` signs users in by reading the magic link from `email_outbox`. Mock Ably and R2 in E2E with `page.route`, or use a test R2 bucket.
2. Write `create-and-join.spec.ts`, `feed.spec.ts` and `module-vote.spec.ts` using **two browser contexts**.
3. `.github/workflows/ci.yml` jobs, as in Brock:
   - `check`: lint, typecheck, unit
   - `integration`: `services: postgres:16`, then `db:migrate`
   - `e2e`: uploads the Playwright report on failure
4. Deploy:
   1. Create a Neon project and put the **pooled** URL in `DATABASE_URL`.
   2. Create the R2 bucket and an API token.
   3. Create an Ably app.
   4. Create a Resend domain and verify it with DNS.
   5. Set up a Sentry project.
   6. Import the repo into Vercel and set every env var from §9 except the `TEST_*` ones.
   7. Add the production Google callback.
   8. Run the migrations.

✅ CI is green on a PR, the production URL works end to end, and your first real Habitat has its first post.

**Total: about 65 hours for one developer.** Phases 0–8 (about 44 hours) are already a usable product with the 4 default modules and voting, so they're a sensible first milestone to share with friends.

---

## 12. Security, privacy and abuse checklist

- [ ] **Habitat isolation.** Every query is scoped by a `habitat_id` taken from a verified membership. `isolation.test.ts` covers every route. Non-members always get `404`.
- [ ] **No IDOR through references.** `parentId`, `media`, `member` and `mediaIds` fields are all checked against the same Habitat.
- [ ] **Media is private.** The bucket has no public access. Signed URLs last 1 hour at most. Uploads are limited to `image/jpeg`, `image/webp` and `image/png` and checked with `HeadObject` for size and type. EXIF is stripped (H16).
- [ ] **XSS.** No `dangerouslySetInnerHTML` (enforced by an ESLint rule). `RichText` builds React nodes. MDL has no HTML. A CSP with `script-src 'self'` (plus Sentry and Ably hosts) is set in `next.config.ts`.
- [ ] **CSRF.** Better Auth cookies are `httpOnly`, `secure` and `sameSite=lax`, and every write route checks `Origin` in `lib/api.ts`.
- [ ] **Invite codes** have 50 bits of entropy and only their SHA-256 hash is stored. Invite acceptance is rate-limited to 10 attempts per IP per hour.
- [ ] **Rate limits** are on: Better Auth's own, 60 record writes per member per minute, 20 uploads per member per hour, and module `limits`.
- [ ] **Votes can't be stuffed.** `PK(proposal_id, user_id)`, members only, votes from former members are dropped at decision time, and votes run under a row lock.
- [ ] **No indexing.** `robots.ts` disallows everything except `/`, and `/h/*` gets an `X-Robots-Tag: noindex` header.
- [ ] **Privacy rights.** Data export (`/api/me/export`), account deletion (removes the user and their content, or anonymises it per H13), and an unsubscribe link in every email.
- [ ] **Moderation.** Reports go to that Habitat's admins. Admins can remove content and members. Everything is in the audit log.
- [ ] **Secrets** are only on the server. `env.ts` fails the build if a `NEXT_PUBLIC_` variable contains a key-looking value.
- [ ] **Known limitation:** Habitat staff (you) can technically read content in the database. Say so in the privacy policy. End-to-end encryption is in §14.

---

## 13. After v1: the AI module builder

The v1 architecture makes this a contained feature rather than a rewrite: **the AI writes MDL (§5.6), and MDL is already a fully working module format.** Nothing generated ever runs as code.

**Flow:**
1. A member opens **Library → Build a module** and describes it in chat ("a tracker for our 5-a-side scores with a season leaderboard").
2. The server calls the Claude API (`@anthropic-ai/sdk`, model from `ANTHROPIC_MODEL`). The system prompt contains the MDL spec, the field types, the block catalogue and `bucket-list/module.json` as an example. Claude replies conversationally and, when ready, calls one tool, `submit_module`, whose input schema is the MDL JSON schema (generated from `mdl-schema.ts` with `z.toJSONSchema`).
3. The server validates the tool input with `mdl-schema.ts`. If it fails, the Zod errors are sent back as the tool result so Claude can fix them, up to 3 attempts.
4. **Preview:** the draft renders with `Renderer.tsx` against in-memory sample data (also generated by Claude, and validated), so the member can try it before anyone votes.
5. **Propose:** "Propose to Habitat" creates a normal `install` proposal. On a pass, it's installed as `custom:<uuid>` and behaves like any other module.
6. Members can keep chatting to revise it. Each saved revision bumps `version`, and changing an installed custom module is itself a `settings` proposal.

**New pieces:**

| Kind | Name |
|---|---|
| Tables | `custom_module` (id, habitat_id, definition jsonb, version, created_by, status `draft`\|`proposed`\|`installed`) and `module_build_session` (id, habitat_id, user_id, messages jsonb, tokens_in, tokens_out) |
| Files | `src/lib/ai/client.ts`, `src/lib/ai/module-builder.ts` (the tool-use loop), `src/lib/ai/system-prompt.md`, `src/lib/ai/sample-data.ts`, `src/app/h/[slug]/library/build/page.tsx`, `src/components/ModuleBuilderChat.tsx`, `src/components/ModulePreview.tsx`, `src/app/api/habitats/[habitatId]/module-builder/route.ts` (streaming), `src/app/api/habitats/[habitatId]/custom-modules/[id]/route.ts` and `tests/integration/module-builder.test.ts` (with recorded API responses as fixtures, so CI never calls the API) |
| Registry | `getModule(id)` falls back to loading `custom:*` from `custom_module` through `load.ts` |
| Limits | 5 builds per Habitat per day and a monthly token budget per Habitat, stored in `module_build_session` |
| Sharing (later) | Let a Habitat publish its custom module to the shared library after a review queue |

**Grow MDL before growing risk.** When groups ask for things MDL can't express, add new blocks (`leaderboard`, `calendar`, `chart`, `map`, `timer`) to the renderer. Each new block makes every future AI module more capable. Only consider AI-written *code* (in a sandboxed iframe on a separate origin, talking to the SDK over `postMessage`) once MDL is clearly the bottleneck.

---

## 14. Also after v1 (out of scope, but the design leaves room)

- **Push notifications:** Web Push through the PWA manifest added in Phase 11.
- **Native apps:** Expo (React Native) against the same API. The records API is already client-agnostic.
- **Sub-groups:** "Climbing crew" inside a bigger Habitat, using a `channel` concept on records.
- **Custom emoji and stickers** made from Habitat photos.
- **Habitat themes:** backgrounds, fonts and a cover banner, voted on like modules.
- **Cross-Habitat events:** invite two Habitats to one event (for weddings).
- **End-to-end encrypted chat:** MLS-based, for the Chat module only to begin with.
- **Habitat Plus:** a paid tier with more storage, video uploads and more AI builds per month. Habitats have no ads, ever.
