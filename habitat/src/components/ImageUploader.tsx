'use client';

import imageCompression from 'browser-image-compression';
import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { useHabitat } from '@/modules/sdk/context';

interface Item {
  key: string;
  preview: string;
  mediaId?: string;
  status: 'uploading' | 'done' | 'error';
}

async function dimensions(file: Blob) {
  const bmp = await createImageBitmap(file);
  const d = { width: bmp.width, height: bmp.height };
  bmp.close();
  return d;
}

/**
 * Pick photos → shrink and re-encode in the browser (which strips EXIF, including GPS) →
 * upload straight to private storage with presigned URLs → confirm. Reports ready media ids.
 */
export function ImageUploader({
  max = 10,
  onChange,
  label = 'Add photos',
}: {
  max?: number;
  onChange: (mediaIds: string[]) => void;
  label?: string;
}) {
  const { habitatId, photosEnabled } = useHabitat();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);

  if (!photosEnabled) return null;

  const report = (next: Item[]) => {
    setItems(next);
    onChange(next.filter((i) => i.status === 'done' && i.mediaId).map((i) => i.mediaId!));
  };

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const picked = [...files].slice(0, Math.max(0, max - items.length));
    const fresh: Item[] = picked.map((f) => ({ key: crypto.randomUUID(), preview: URL.createObjectURL(f), status: 'uploading' }));
    let current = [...items, ...fresh];
    report(current);

    try {
      const prepared = await Promise.all(
        picked.map(async (f) => {
          const opts = { fileType: 'image/jpeg', initialQuality: 0.85, useWebWorker: true };
          const full = await imageCompression(f, { ...opts, maxWidthOrHeight: 2048, maxSizeMB: 4 });
          const thumb = await imageCompression(f, { ...opts, maxWidthOrHeight: 480, maxSizeMB: 0.2 });
          return { full, thumb, ...(await dimensions(full)) };
        }),
      );
      const { uploads } = await apiFetch<{ uploads: Array<{ mediaId: string; putFull: string; putThumb: string }> }>(`/api/habitats/${habitatId}/uploads`, {
        method: 'POST',
        body: { files: prepared.map((p) => ({ mime: 'image/jpeg', bytes: p.full.size, width: p.width, height: p.height })) },
      });
      await Promise.all(
        uploads.map(async (u, i) => {
          const p = prepared[i]!;
          const key = fresh[i]!.key;
          try {
            const put = (url: string, blob: Blob) =>
              fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } }).then((r) => {
                if (!r.ok) throw new Error('upload failed');
              });
            await Promise.all([put(u.putFull, p.full), put(u.putThumb, p.thumb)]);
            await apiFetch(`/api/habitats/${habitatId}/uploads/${u.mediaId}`, { method: 'POST' });
            current = current.map((c) => (c.key === key ? { ...c, status: 'done', mediaId: u.mediaId } : c));
          } catch {
            current = current.map((c) => (c.key === key ? { ...c, status: 'error' } : c));
          }
          report([...current]);
        }),
      );
    } catch (e) {
      toast.error(errorMessage(e));
      current = current.map((c) => (fresh.some((f) => f.key === c.key) ? { ...c, status: 'error' } : c));
      report(current);
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((i) => (
            <li key={i.key} className="relative h-20 w-20 overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.preview} alt="" className={`h-full w-full object-cover ${i.status !== 'done' ? 'opacity-50' : ''}`} />
              {i.status === 'uploading' && <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">…</span>}
              {i.status === 'error' && <span className="absolute inset-0 flex items-center justify-center bg-danger/40 text-xs font-bold text-white">Failed</span>}
              <button type="button" aria-label="Remove photo" onClick={() => report(items.filter((x) => x.key !== i.key))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length < max && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" onChange={(e) => add(e.target.files)} aria-label={label} />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus size={16} /> {label}
          </Button>
        </>
      )}
    </div>
  );
}
