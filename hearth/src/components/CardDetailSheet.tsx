'use client';

import { useState } from 'react';
import { CardImage } from '@/components/CardImage';
import { Sheet } from '@/components/Sheet';
import type { ItemCard } from '@/lib/catalogue/load';
import { formatDimensions, formatPrice } from '@/lib/locale';
import {
  attributeFamily,
  attributeLabel,
  CATEGORY_LABELS,
  styleLabel,
  type Category,
} from '@/lib/taxonomy';

interface Props {
  card: ItemCard | null;
  onClose: () => void;
  /** Swiping from inside the sheet (R27). Omit for read-only use. */
  onAnswer?: (value: 1 | -1) => void;
  onVeto?: () => void;
  canVeto?: boolean;
}

/** More photos, price, size and materials before you decide (R27). */
export function CardDetailSheet({ card, onClose, onAnswer, onVeto, canVeto }: Props) {
  const [index, setIndex] = useState(0);
  const images = card
    ? [card.imageUrl, ...card.extraImages.filter((u) => u !== card.imageUrl)]
    : [];
  const size = card ? formatDimensions(card.widthCm, card.depthCm, card.heightCm) : null;
  const features = card?.attributes.filter((a) => attributeFamily(a) !== 'practical') ?? [];

  return (
    <Sheet open={!!card} onClose={onClose} title="Details">
      {card ? (
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
            <CardImage
              src={images[index] ?? card.imageUrl}
              alt={card.title}
              className="h-full w-full object-cover"
              eager
            />
            {images.length > 1 ? (
              <div
                className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5"
                role="group"
                aria-label="Photos"
              >
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === index}
                    onClick={() => setIndex(i)}
                    className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-paper' : 'bg-paper/50'}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{card.title}</h2>
            <p className="text-sm text-muted">
              {[
                card.category ? CATEGORY_LABELS[card.category as Category] : null,
                card.primaryStyle ? styleLabel(card.primaryStyle) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {card.tier === 'micro' ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Price</dt>
                <dd className="font-semibold">
                  {formatPrice(card.pricePence) || 'Price not listed'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Stock</dt>
                <dd className="font-semibold">{card.inStock ? 'In stock' : 'Out of stock'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Size</dt>
                <dd className="font-semibold">{size ?? 'Size not listed'}</dd>
              </div>
            </dl>
          ) : card.attributionName ? (
            <p className="text-xs text-muted">
              Photo by{' '}
              {card.attributionUrl ? (
                <a className="underline" href={card.attributionUrl} rel="noreferrer">
                  {card.attributionName}
                </a>
              ) : (
                card.attributionName
              )}
            </p>
          ) : null}
          <ul className="flex flex-wrap gap-1.5" aria-label="Features">
            {features.map((a) => (
              <li key={a} className="chip">
                {attributeLabel(a)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {onAnswer ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={() => {
                    onAnswer(-1);
                    onClose();
                  }}
                >
                  Not for us
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  onClick={() => {
                    onAnswer(1);
                    onClose();
                  }}
                >
                  Love it
                </button>
              </>
            ) : null}
            {onVeto && canVeto ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onClose();
                  onVeto();
                }}
              >
                Veto
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
