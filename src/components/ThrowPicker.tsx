'use client';

import { THROWS, type Throw } from '@/lib/game';
import { Hand } from './Hands';

interface Props {
  disabled?: boolean;
  onPick: (t: Throw) => void;
}

const LABEL: Record<Throw, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

export function ThrowPicker({ disabled, onPick }: Props) {
  return (
    <div role="group" aria-label="Choose your throw" className="grid w-full grid-cols-3 gap-2.5">
      {THROWS.map((t) => (
        <button
          key={t}
          type="button"
          className="throw"
          disabled={disabled}
          aria-label={LABEL[t]}
          onClick={() => onPick(t)}
        >
          <Hand shape={t} />
          <span aria-hidden="true">{LABEL[t].toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
