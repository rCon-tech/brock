'use client';

import { useState } from 'react';
import { Lightbox } from '@/components/Lightbox';
import { MediaImage } from '@/components/MediaImage';
import { RichText } from '@/components/RichText';
import { cn } from '@/lib/utils';
import { useHabitat } from '../sdk/context';
import type { FeedCardProps } from '../sdk/types';

export function MediaGrid({ ids, alt }: { ids: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!ids.length) return null;
  const shown = ids.slice(0, 4);
  return (
    <>
      <div className={cn('grid gap-1 overflow-hidden rounded-xl', ids.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
        {shown.map((id, i) => (
          <div key={id} className="relative">
            <MediaImage
              id={id}
              alt={`${alt} (photo ${i + 1} of ${ids.length})`}
              variant={ids.length === 1 ? 'full' : 'thumb'}
              className={cn('w-full', ids.length === 1 ? 'max-h-[28rem]' : 'aspect-square')}
              onClick={() => setOpen(i)}
            />
            {i === 3 && ids.length > 4 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">+{ids.length - 4}</span>
            )}
          </div>
        ))}
      </div>
      <Lightbox ids={ids} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} alt={(i) => `${alt} (photo ${i + 1} of ${ids.length})`} />
    </>
  );
}

export function FeedCard({ record }: FeedCardProps) {
  const { members } = useHabitat();
  const names = members.flatMap((m) => [m.name, m.nickname ?? '']).filter(Boolean);
  const text = typeof record.data.text === 'string' ? record.data.text : '';
  const ids = (record.data.mediaIds as string[] | undefined) ?? [];
  const who = record.author ? record.author.nickname || record.author.name : 'A former member';
  return (
    <div className="space-y-2">
      {text && <RichText text={text} names={names} className="text-[15px] leading-relaxed" />}
      <MediaGrid ids={ids} alt={`Photo by ${who}`} />
    </div>
  );
}
