'use client';

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import type { ItemCard } from '@/lib/catalogue/load';
import { attributeLabel } from '@/lib/taxonomy';

interface Props {
  card: ItemCard | null;
  vetoesLeft: number;
  onClose: () => void;
  onConfirm: (attribute: string | null) => void;
}

/** A veto is a hard no. Naming what you can't live with removes it everywhere (R9). */
export function VetoSheet({ card, vetoesLeft, onClose, onConfirm }: Props) {
  const [attribute, setAttribute] = useState<string | null>(null);
  const close = () => {
    setAttribute(null);
    onClose();
  };
  return (
    <Sheet open={!!card} onClose={close} title="Use a veto">
      {card ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold">Really can’t live with it?</h2>
            <p className="text-sm text-muted">
              A veto means you’ll never be shown this, and neither will your partner’s picks include
              it. You have {vetoesLeft} {vetoesLeft === 1 ? 'veto' : 'vetoes'} left.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">What’s the deal-breaker? (optional)</legend>
            <p className="text-xs text-muted">
              Tap a feature to rule it out everywhere, not just this card.
            </p>
            <div className="flex flex-wrap gap-2">
              {card.attributes.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={attribute === a}
                  onClick={() => setAttribute(attribute === a ? null : a)}
                  className={`chip min-h-9 px-3 ${attribute === a ? 'bg-clay text-paper' : ''}`}
                >
                  {attributeLabel(a)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => {
                onConfirm(attribute);
                setAttribute(null);
              }}
            >
              {attribute ? `Veto ${attributeLabel(attribute)}` : 'Veto this card'}
            </button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
