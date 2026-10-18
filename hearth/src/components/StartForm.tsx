'use client';

import { useActionState, useMemo, useState } from 'react';
import { createProjectAction, type StartState } from '@/app/start/actions';
import type { ProjectContext } from '@/lib/context';
import { QUOTAS } from '@/lib/engine/quotas';
import {
  ATTRIBUTE_FAMILIES,
  BUDGET_BANDS,
  BUDGET_LABELS,
  CATEGORY_LABELS,
  ROOM_LABELS,
  type BudgetBand,
  type Category,
  type RoomType,
} from '@/lib/taxonomy';

type Keeping = ProjectContext['keeping'][number];
type SizeLimit = ProjectContext['maxSize'][number];

const MODES = [
  {
    value: 'remote',
    title: 'Send a link',
    body: 'They swipe on their own phone, whenever suits them.',
  },
  {
    value: 'together_devices',
    title: 'Together, two phones',
    body: 'You swipe at the same time and reveal together.',
  },
  {
    value: 'together_one_device',
    title: 'Together, one phone',
    body: 'Pass the phone back and forth.',
  },
] as const;

interface Props {
  rooms: RoomType[];
  quiz?: boolean;
  partner?: string;
}

export function StartForm({ rooms, quiz = false, partner }: Props) {
  const [state, formAction, pending] = useActionState<StartState, FormData>(
    createProjectAction,
    {},
  );
  const [room, setRoom] = useState<RoomType>(rooms[0]);
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('remote');
  const [budget, setBudget] = useState<BudgetBand | ''>('');
  const [keeping, setKeeping] = useState<Keeping[]>([]);
  const [household, setHousehold] = useState({ dog: false, cat: false, youngKids: false });
  const [sizes, setSizes] = useState<SizeLimit[]>([]);

  const categories = useMemo(() => Object.keys(QUOTAS[room]) as Category[], [room]);
  const context: ProjectContext = {
    keeping: keeping.filter((k) => categories.includes(k.category)),
    household,
    maxSize: sizes.filter((s) => categories.includes(s.category) && (s.widthCm || s.depthCm)),
    hidePracticalRisks: false,
  };

  function toggleKeep(category: Category) {
    setKeeping((k) =>
      k.some((x) => x.category === category)
        ? k.filter((x) => x.category !== category)
        : [...k, { category }],
    );
  }
  function updateKeep(category: Category, patch: Partial<Keeping>) {
    setKeeping((k) => k.map((x) => (x.category === category ? { ...x, ...patch } : x)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="context" value={JSON.stringify(context)} />
      <input type="hidden" name="roomType" value={room} />
      <input type="hidden" name="mode" value={quiz ? 'remote' : mode} />
      <input type="hidden" name="budgetBand" value={budget} />
      {quiz ? <input type="hidden" name="quiz" value="1" /> : null}
      {partner ? <input type="hidden" name="refPartner" value={partner} /> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-bold">Which room?</legend>
        <div className="grid grid-cols-3 gap-2">
          {rooms.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={room === r}
              onClick={() => setRoom(r)}
              className={`card min-h-20 p-3 text-sm font-semibold ${room === r ? 'border-clay bg-blush ring-2 ring-clay' : ''}`}
            >
              {ROOM_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>

      {!quiz ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-bold">How are you doing this?</legend>
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`card flex cursor-pointer gap-3 p-3 ${mode === m.value ? 'border-clay bg-blush ring-2 ring-clay' : ''}`}
            >
              <input
                type="radio"
                name="mode-choice"
                className="mt-1 accent-clay"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span>
                <span className="block font-semibold">{m.title}</span>
                <span className="text-sm text-muted">{m.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold">A few quick questions</h2>
          <p className="text-sm text-muted">
            Optional, but they make the suggestions fit your actual home.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">What are you keeping?</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = keeping.some((k) => k.category === c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleKeep(c)}
                  className={`chip min-h-9 px-3 ${on ? 'bg-clay text-paper' : ''}`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
          {keeping
            .filter((k) => categories.includes(k.category))
            .map((k) => (
              <div key={k.category} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="font-semibold">{CATEGORY_LABELS[k.category]}:</span>
                <select
                  aria-label={`${CATEGORY_LABELS[k.category]} colour`}
                  className="field w-auto py-1.5 text-sm"
                  value={k.colour ?? ''}
                  onChange={(e) =>
                    updateKeep(k.category, {
                      colour: (e.target.value || undefined) as Keeping['colour'],
                    })
                  }
                >
                  <option value="">any colour</option>
                  {ATTRIBUTE_FAMILIES.colour.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`${CATEGORY_LABELS[k.category]} material`}
                  className="field w-auto py-1.5 text-sm"
                  value={k.material ?? ''}
                  onChange={(e) =>
                    updateKeep(k.category, {
                      material: (e.target.value || undefined) as Keeping['material'],
                    })
                  }
                >
                  <option value="">any material</option>
                  {ATTRIBUTE_FAMILIES.material.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Who lives there?</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['dog', 'A dog'],
                ['cat', 'A cat'],
                ['youngKids', 'Young kids'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={household[key]}
                onClick={() => setHousehold((h) => ({ ...h, [key]: !h[key] }))}
                className={`chip min-h-9 px-3 ${household[key] ? 'bg-clay text-paper' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Any tight spaces?</legend>
          {sizes.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <select
                aria-label="Item"
                className="field w-auto py-1.5 text-sm"
                value={s.category}
                onChange={(e) =>
                  setSizes((all) =>
                    all.map((x, j) =>
                      j === i ? { ...x, category: e.target.value as Category } : x,
                    ),
                  )
                }
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <span>no wider than</span>
              <input
                aria-label="Maximum width in centimetres"
                inputMode="numeric"
                className="field w-20 py-1.5 text-sm"
                placeholder="cm"
                value={s.widthCm ?? ''}
                onChange={(e) =>
                  setSizes((all) =>
                    all.map((x, j) =>
                      j === i ? { ...x, widthCm: Number(e.target.value) || undefined } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSizes((all) => all.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          {sizes.length < 3 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm self-start"
              onClick={() => setSizes((all) => [...all, { category: categories[0] }])}
            >
              + Add a size limit
            </button>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Budget</legend>
          <div className="flex gap-2">
            {BUDGET_BANDS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={budget === b}
                onClick={() => setBudget(budget === b ? '' : b)}
                className={`chip min-h-9 px-4 ${budget === b ? 'bg-clay text-paper' : ''}`}
              >
                {BUDGET_LABELS[b]}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="flex flex-col gap-3">
        {!quiz ? (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Room name (optional)
            <input
              name="name"
              className="field font-normal"
              placeholder="e.g. Our front room"
              maxLength={60}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Your first name
          <input
            name="displayName"
            required
            maxLength={40}
            autoComplete="given-name"
            className="field font-normal"
          />
        </label>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-blush p-3 text-sm text-clay-dark">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Setting up…' : quiz ? 'Start the quiz' : 'Create the room'}
      </button>
    </form>
  );
}
