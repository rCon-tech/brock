'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { ImageUploader } from '@/components/ImageUploader';
import { Lightbox } from '@/components/Lightbox';
import { MediaImage } from '@/components/MediaImage';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { errorMessage } from '@/lib/api-client';
import { useHabitat } from '../sdk/context';
import { useCreateRecord, useRecord, useRecords, useUpdateRecord } from '../sdk/hooks';

export function AlbumView({ albumId }: { albumId: string }) {
  const { slug } = useHabitat();
  const album = useRecord<{ title: string; description?: string; coverMediaId?: string }>(albumId);
  const photos = useRecords<{ mediaId: string; caption?: string }>({ module: 'photos', collection: 'photo', parentId: albumId, order: 'createdAt:asc', limit: 100 });
  const addPhoto = useCreateRecord('photos', 'photo');
  const updateAlbum = useUpdateRecord('photos');
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  if (album.isLoading) return <Skeleton className="h-40" />;
  if (album.isError || !album.data) return <EmptyState emoji="🌫️" title="That album isn’t here anymore" />;

  const ids = photos.items.map((p) => p.data.mediaId);

  async function save() {
    setSaving(true);
    try {
      for (const mediaId of pending) await addPhoto.mutateAsync({ parentId: albumId, data: { mediaId } });
      if (!album.data!.data.coverMediaId && pending[0]) await updateAlbum.mutateAsync({ id: albumId, data: { coverMediaId: pending[0] } });
      toast.success(`Added ${pending.length} ${pending.length === 1 ? 'photo' : 'photos'}`);
      setPending([]);
      setUploaderKey((k) => k + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/h/${slug}/m/photos`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={14} /> Albums
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold">{album.data.data.title}</h1>
        {album.data.data.description && <p className="text-ink-soft">{album.data.data.description}</p>}
      </div>

      <div className="space-y-2 rounded-2xl border border-dashed border-line p-3">
        <ImageUploader key={uploaderKey} max={20} onChange={setPending} label="Choose photos" />
        {pending.length > 0 && (
          <Button onClick={save} disabled={saving}>
            {saving ? 'Adding…' : `Add ${pending.length} to album`}
          </Button>
        )}
      </div>

      {photos.isLoading ? (
        <Skeleton className="h-40" />
      ) : ids.length === 0 ? (
        <EmptyState emoji="📷" title="No photos yet">
          Be the first to add one.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {photos.items.map((p, i) => (
            <li key={p.id}>
              <MediaImage id={p.data.mediaId} alt={p.data.caption || `${album.data!.data.title}, photo ${i + 1}`} className="aspect-square w-full" onClick={() => setOpen(i)} />
            </li>
          ))}
        </ul>
      )}
      {photos.hasNextPage && (
        <Button variant="outline" onClick={() => photos.fetchNextPage()}>
          Load more
        </Button>
      )}
      <Lightbox ids={ids} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} alt={(i) => photos.items[i]?.data.caption || `${album.data!.data.title}, photo ${i + 1}`} />
    </div>
  );
}
