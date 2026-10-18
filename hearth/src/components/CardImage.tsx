'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef } from 'react';

/**
 * Plain <img> on purpose: card art comes from Unsplash and retailer feeds (hotlinked, per their
 * terms), and the generated placeholders are tiny SVGs, so the image optimiser adds nothing.
 *
 * `onError` also fires for an image that already failed before React hydrated. The browser's
 * error event isn't replayed once it has passed, so a server-rendered broken image would
 * otherwise go unnoticed (R33).
 */
export function CardImage({
  src,
  alt,
  className = '',
  onError,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  eager?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const handler = useRef(onError);
  useEffect(() => {
    handler.current = onError;
  });

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) handler.current?.();
    // Only once, on arrival: later failures arrive through the onError prop below.
  }, []);

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={onError}
    />
  );
}
