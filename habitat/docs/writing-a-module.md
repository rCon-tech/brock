# Writing a module

A Habitat is built from modules. A module is a **manifest** (what it stores, who may do what, who gets notified) plus some **UI**. You never touch the database: the platform stores, validates, secures and notifies for you.

There are two ways to write one:

|                                | Code module                               | Declarative module (MDL)                                                  |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| Written as                     | TypeScript + React in `src/modules/<id>/` | One `module.json`                                                         |
| UI                             | Anything you can build                    | A fixed set of blocks: stack, text, form, list, tabs, counter, image-grid |
| Needs a deploy                 | Yes                                       | Yes today; **no** once modules are stored per Habitat (the AI builder)    |
| Safe to accept from a stranger | No (it's code)                            | Yes (it's validated data)                                                 |

Start with MDL. Reach for code only when the blocks can't express what you need.

## The manifest

```ts
{
  id: 'polls',                 // kebab-case, unique
  name: 'Polls', tagline: 'Settle it with a vote', description: '…',
  icon: 'bar-chart-3',         // a lucide icon name (see components/ModuleIcon.tsx)
  category: 'social' | 'plans' | 'fun' | 'practical',
  version: 1,                  // bump when collections change
  isDefault: false,            // true = installed when a Habitat is created
  nav: { label: 'Polls', order: 10 },   // or `false` for no menu entry
  collections: { poll: {…}, vote: {…} }
}
```

### Collections

Each collection is a kind of record:

```ts
poll: {
  fields: {
    question: { type: 'text', max: 200, required: true },
    options:  { type: 'text-list', minItems: 2, maxItems: 10, maxLength: 100 },
    closesAt: { type: 'datetime' },
  },
  showInTimeline: true,          // appears on the Habitat home page
  realtime: false,               // push changes live
  permissions: { create: 'member', update: 'admin', delete: 'author-or-admin' },
  notify: [{ on: 'create', to: 'all-members', text: '{author} asked “{question}”' }],
  limits: { perMemberPerDay: 5, maxPerHabitat: 500 },
},
vote: {
  parent: 'poll',                       // hangs off a poll
  unique: 'per-member-per-parent',      // one vote each; voting again updates it
  lockedAfterParentField: 'closesAt',   // refused once the poll has closed
  fields: { choices: { type: 'text-list', minItems: 1, maxItems: 10, maxLength: 100 } },
}
```

**Field types:** `text`, `longtext`, `integer`, `number`, `boolean`, `date`, `datetime`, `enum`, `url`, `media`, `media-list`, `member`, `member-list`, `text-list`, `money` (integer minor units: pence, cents).

**Other options**

- `atLeastOne: ['text', 'mediaIds']`: a post needs words or a photo.
- `permissions.hiddenFrom: 'parent-author'`: the person a record is _about_ never sees it (Wishlist claims). Enforced in every read, including the timeline.
- `notify.to`: `all-members`, `parent-author` or `mentioned` (people @-mentioned in the text fields).
- Update/delete scopes: `author`, `admin`, `author-or-admin`, `member` (anyone).

### What the platform does for every module

1. **Validates** every write against your fields (and checks that photo and member ids belong to this Habitat).
2. **Enforces permissions** and the install check (a removed module is hidden for 30 days, then purged).
3. Gives every record **comments, reactions and pinning** for free.
4. Writes **notifications** in the same transaction as the record.
5. Publishes **realtime** events for `realtime: true` collections.
6. **Rate limits** (60 writes a minute per member) and applies your `limits`.

## A declarative module

`src/modules/bucket-list/module.json` is a complete example. It has a `manifest` (above) and `views.main`:

```json
{
  "type": "stack",
  "children": [
    {
      "type": "counter",
      "collection": "idea",
      "filter": { "field": "done", "op": "eq", "value": true },
      "label": "ticked off"
    },
    {
      "type": "form",
      "collection": "idea",
      "title": "Add an idea",
      "fields": ["title", "details"]
    },
    {
      "type": "list",
      "collection": "idea",
      "filter": { "field": "done", "op": "eq", "value": false },
      "cells": [
        { "field": "done", "as": "toggle" },
        { "field": "title", "as": "title" }
      ]
    }
  ]
}
```

| Block        | Does                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack`      | Vertical group of blocks (up to 12 children, 4 levels deep)                                                                                       |
| `text`       | A line of text (`title`, `muted` or `body`)                                                                                                       |
| `form`       | A form generated from a collection's fields                                                                                                       |
| `list`       | Records with a filter and cells (`title`, `text`, `muted`, `badge`, `link`, `toggle`, `image`, `money`, `date`); each gets comments and reactions |
| `tabs`       | Tabs, each holding a block                                                                                                                        |
| `counter`    | "3 of 12" for records matching a filter                                                                                                           |
| `image-grid` | A grid of photos from a photo field                                                                                                               |

There is no HTML, no script and no expression language. `src/modules/declarative/mdl-schema.ts` rejects anything else, and checks that every collection and field you mention exists, with an error that names the exact path.

## A code module

1. `src/modules/<id>/manifest.ts`: the manifest (server-safe, no React).
2. `src/modules/<id>/Page.tsx` (+ optional `FeedCard.tsx`, `Widget.tsx`): `'use client'` components that use `useRecords`, `useCreateRecord`, `useUpdateRecord`, `useDeleteRecord` and `useHabitat()` from `src/modules/sdk`.
3. `src/modules/<id>/index.ts`: `export default defineModule({ manifest, Page, FeedCard, Widget })`.
4. Register the manifest in `src/modules/registry.ts` and the module in `src/modules/ui-registry.ts`.
5. Put pure logic (tallies, money maths, date maths) in plain `.ts` files and unit-test it.

## Checklist before you ship a module

- [ ] The manifest passes `pnpm test` (`parseManifest` names the bad path).
- [ ] It works at 375px wide, and has an empty state with one clear action.
- [ ] Nothing renders user text as HTML; use `RichText`.
- [ ] Anything private is protected by `hiddenFrom` or a permission, not just hidden in the UI.
- [ ] An integration test covers create, permissions and anything unusual (see `tests/integration/records.test.ts`).
