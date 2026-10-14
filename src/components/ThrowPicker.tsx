'use client';

import { THROWS, THROW_EMOJI, type Throw } from '@/lib/game';

interface Props {
  disabled?: boolean;
  onPick: (t: Throw) => void;
}

const LABEL: Record<Throw, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

export function ThrowPicker({ disabled, onPick }: Props) {
  return (
    <div role="group" aria-label="Choose your throw" className="grid grid-cols-3 gap-3">
      {THROWS.map((t) => (
        <button
          key={t}
          type="button"
          disabled={disabled}
          aria-label={LABEL[t]}
          onClick={() => onPick(t)}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-brock-line bg-brock-card text-5xl transition hover:-translate-y-0.5 hover:border-brock-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:text-6xl"
        >
          <span aria-hidden>{THROW_EMOJI[t]}</span>
          <span className="text-sm font-semibold text-brock-muted">{LABEL[t]}</span>
        </button>
      ))}
    </div>
  );
}
