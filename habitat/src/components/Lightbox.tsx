'use client';

import * as D from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MediaImage } from '@/components/MediaImage';

/** Full-screen photo viewer: arrow keys, buttons and swipe. */
export function Lightbox({
  ids,
  index,
  onIndexChange,
  onClose,
  alt,
}: {
  ids: string[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  alt: (i: number) => string;
}) {
  const startX = useRef<number | null>(null);
  const open = index !== null;
  const go = (d: number) => index !== null && onIndexChange((index + d + ids.length) % ids.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <D.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onTouchStart={(e) => (startX.current = e.touches[0]!.clientX)}
          onTouchEnd={(e) => {
            if (startX.current === null) return;
            const dx = e.changedTouches[0]!.clientX - startX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            startX.current = null;
          }}
        >
          <D.Title className="sr-only">Photo viewer</D.Title>
          <D.Description className="sr-only">
            Use the arrow keys or swipe to move between photos.
          </D.Description>
          {index !== null && (
            <MediaImage
              id={ids[index]!}
              variant="full"
              alt={alt(index)}
              className="max-h-dvh max-w-full object-contain"
            />
          )}
          <D.Close
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white"
          >
            <X size={22} />
          </D.Close>
          {ids.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
