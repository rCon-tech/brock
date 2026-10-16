'use client';

import { Star } from 'lucide-react';
import { RichText } from '@/components/RichText';
import type { FeedCardProps } from '../sdk/types';

export const KINDS: Record<string, { label: string; emoji: string }> = {
  book: { label: 'Book', emoji: '📚' },
  film: { label: 'Film', emoji: '🎬' },
  tv: { label: 'TV', emoji: '📺' },
  music: { label: 'Music', emoji: '🎵' },
  place: { label: 'Place', emoji: '📍' },
  game: { label: 'Game', emoji: '🎮' },
  other: { label: 'Other', emoji: '✨' },
};

export function RecCard({ record }: FeedCardProps) {
  const d = record.data as {
    kind: string;
    title: string;
    link?: string;
    note?: string;
    rating?: number;
  };
  const k = KINDS[d.kind] ?? KINDS.other!;
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">recommends a {k.label.toLowerCase()}</p>
      <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
        <span className="text-3xl" aria-hidden>
          {k.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {d.link ? (
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-accent underline underline-offset-2"
              >
                {d.title}
              </a>
            ) : (
              d.title
            )}
          </div>
          {d.rating ? (
            <div className="flex" role="img" aria-label={`${d.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  className={n <= d.rating! ? 'fill-accent text-accent' : 'text-line'}
                />
              ))}
            </div>
          ) : null}
          {d.note && <RichText text={d.note} className="mt-1 text-sm" />}
        </div>
      </div>
    </div>
  );
}
