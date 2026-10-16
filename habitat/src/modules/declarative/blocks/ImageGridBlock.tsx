'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Lightbox } from '@/components/Lightbox';
import { MediaImage } from '@/components/MediaImage';
import { useRecords } from '../../sdk/hooks';

export function ImageGridBlock({
  moduleId,
  collection,
  field,
}: {
  moduleId: string;
  collection: string;
  field: string;
}) {
  const q = useRecords({ module: moduleId, collection, limit: 60 });
  const ids = q.items.flatMap((r) => {
    const v = r.data[field];
    return Array.isArray(v) ? (v as string[]) : typeof v === 'string' ? [v] : [];
  });
  const [open, setOpen] = useState<number | null>(null);
  if (!ids.length) return <EmptyState emoji="🖼️" title="No photos yet" />;
  return (
    <>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {ids.map((id, i) => (
          <li key={id}>
            <MediaImage
              id={id}
              alt={`Photo ${i + 1}`}
              className="aspect-square w-full"
              onClick={() => setOpen(i)}
            />
          </li>
        ))}
      </ul>
      <Lightbox
        ids={ids}
        index={open}
        onIndexChange={setOpen}
        onClose={() => setOpen(null)}
        alt={(i) => `Photo ${i + 1}`}
      />
    </>
  );
}
