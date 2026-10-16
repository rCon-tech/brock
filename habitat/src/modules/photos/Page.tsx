'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { MediaImage } from '@/components/MediaImage';
import { RelativeTime } from '@/components/RelativeTime';
import { Skeleton } from '@/components/ui/card';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';
import type { PageProps } from '../sdk/types';
import { AlbumView } from './AlbumView';
import { NewAlbumDialog } from './NewAlbumDialog';

export function Page({ path }: PageProps) {
  if (path[0]) return <AlbumView albumId={path[0]} />;
  return <Albums />;
}

function Albums() {
  const { slug, photosEnabled } = useHabitat();
  const router = useRouter();
  const albums = useRecords<{ title: string; description?: string; coverMediaId?: string }>({
    module: 'photos',
    collection: 'album',
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Photos</h1>
        <NewAlbumDialog onCreated={(id) => router.push(`/h/${slug}/m/photos/${id}`)} />
      </div>
      {!photosEnabled && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">
          Photo uploads aren’t switched on for this server yet. You can still make albums.
        </p>
      )}
      {albums.isLoading ? (
        <Skeleton className="h-40" />
      ) : albums.items.length === 0 ? (
        <EmptyState emoji="🖼️" title="No albums yet">
          Make one for your next trip or night out.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {albums.items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/h/${slug}/m/photos/${a.id}`}
                className="block overflow-hidden rounded-2xl border border-line bg-surface hover:shadow-md"
              >
                <div className="flex aspect-square items-center justify-center bg-surface-2 text-4xl">
                  {a.data.coverMediaId ? (
                    <MediaImage id={a.data.coverMediaId} alt="" className="h-full w-full" />
                  ) : (
                    <span aria-hidden>📷</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate font-bold">{a.data.title}</div>
                  <div className="text-xs text-ink-soft">
                    <RelativeTime iso={a.createdAt} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
