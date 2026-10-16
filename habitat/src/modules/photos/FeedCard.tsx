'use client';

import Link from 'next/link';
import { MediaImage } from '@/components/MediaImage';
import { useHabitat } from '../sdk/context';
import type { FeedCardProps } from '../sdk/types';

export function FeedCard({ record }: FeedCardProps) {
  const { slug } = useHabitat();
  const cover = record.data.coverMediaId as string | undefined;
  return (
    <Link href={`/h/${slug}/m/photos/${record.id}`} className="block space-y-2">
      <p className="text-sm text-ink-soft">started an album</p>
      <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-2xl">
          {cover ? <MediaImage id={cover} alt="" className="h-full w-full" /> : <span aria-hidden>🖼️</span>}
        </span>
        <span className="font-bold">{String(record.data.title)}</span>
      </div>
    </Link>
  );
}
