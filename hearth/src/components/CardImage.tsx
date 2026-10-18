/* eslint-disable @next/next/no-img-element */
/**
 * Plain <img> on purpose: card art comes from Unsplash and retailer feeds (hotlinked, per their
 * terms), and the generated placeholders are tiny SVGs, so the image optimiser adds nothing.
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
  return (
    <img
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
