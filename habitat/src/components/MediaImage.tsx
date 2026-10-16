'use client';

import { cn } from '@/lib/utils';

/** A private photo. The URL redirects to a short-lived signed link after a membership check. */
export function MediaImage({
  id,
  variant = 'thumb',
  alt,
  className,
  onClick,
}: {
  id: string;
  variant?: 'thumb' | 'full';
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- a signed redirect, so next/image can't optimise it
    <img
      src={`/api/media/${id}?v=${variant}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('bg-surface-2 object-cover', className)}
    />
  );
  if (!onClick) return img;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block overflow-hidden rounded-xl"
      aria-label={`Open photo: ${alt}`}
    >
      {img}
    </button>
  );
}
