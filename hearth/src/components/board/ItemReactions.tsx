'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { reactAction } from '@/app/r/[projectId]/board/actions';

type Reaction = 'love' | 'unsure' | 'no';
const BUTTONS: { value: Reaction; label: string; icon: string }[] = [
  { value: 'love', label: 'Love it', icon: '❤️' },
  { value: 'unsure', label: 'Not sure', icon: '🤔' },
  { value: 'no', label: 'Not for us', icon: '✕' },
];
const NOTE_MAX = 140;

interface Props {
  participantId: string;
  itemId: string;
  mine?: { reaction: Reaction; note: string | null };
  /** What everyone else said, by name (this is the discussion layer, so names show). */
  others: { name: string; reaction: Reaction; note: string | null }[];
}

/** ❤️ / 🤔 / ✕ and a one-line note on any item (R29). No chat. */
export function ItemReactions({ participantId, itemId, mine, others }: Props) {
  const router = useRouter();
  const [reaction, setReaction] = useState<Reaction | null>(mine?.reaction ?? null);
  const [note, setNote] = useState(mine?.note ?? '');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function save(next: Reaction | null, nextNote: string) {
    setError(null);
    start(async () => {
      const res = await reactAction(participantId, itemId, next, nextNote || undefined);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-sand pt-2">
      <div className="flex items-center gap-1.5" role="group" aria-label="Your reaction">
        {BUTTONS.map((b) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={reaction === b.value}
            aria-label={b.label}
            title={b.label}
            className={`btn btn-sm min-w-10 ${reaction === b.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              const next = reaction === b.value ? null : b.value;
              setReaction(next);
              save(next, note);
            }}
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
        >
          {note ? 'Edit note' : 'Add note'}
        </button>
      </div>
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            save(reaction ?? 'unsure', note);
            if (!reaction) setReaction('unsure');
          }}
        >
          <input
            aria-label="Note"
            className="field py-1.5 text-sm"
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. love this but in green?"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Save
          </button>
        </form>
      ) : null}
      {note && !editing ? <p className="text-sm">“{note}”</p> : null}
      {others.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted">
          {others.map((o) => (
            <li key={o.name}>
              <span className="font-semibold text-ink">{o.name}</span>{' '}
              {BUTTONS.find((b) => b.value === o.reaction)?.icon}
              {o.note ? ` “${o.note}”` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-clay-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
