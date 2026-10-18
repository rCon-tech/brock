import { cosine } from './vector';
import type { Profile } from './profile';
import type { Centroid } from './types';

export interface Bridge {
  style: string | null;
  /** Everyone's own top style is the same, so there is nothing to bridge. */
  alreadyAgree: boolean;
  topStyles: Record<string, string[]>;
}

/**
 * Maximin: the style whose least-happy person likes it most. This is the idea that keeps the
 * result from being "whoever swiped more confidently wins".
 */
export function chooseBridge(profiles: Profile[], centroids: Centroid[]): Bridge {
  const withTaste = profiles.filter((p) => p.taste);
  const topStyles = Object.fromEntries(
    profiles.map((p) => [p.personId, p.topStyles.map((s) => s.style)]),
  );
  if (withTaste.length === 0 || centroids.length === 0) {
    return { style: null, alreadyAgree: false, topStyles };
  }
  const alreadyAgree =
    withTaste.length > 1 &&
    withTaste.every((p) => p.topStyles[0]?.style === withTaste[0].topStyles[0]?.style);
  if (withTaste.length === 1 || alreadyAgree) {
    return { style: withTaste[0].topStyles[0]?.style ?? null, alreadyAgree, topStyles };
  }
  let best: { style: string; score: number } | null = null;
  for (const c of centroids) {
    const score = Math.min(...withTaste.map((p) => cosine(p.taste!, c.vector)));
    if (!best || score > best.score) best = { style: c.slug, score };
  }
  return { style: best?.style ?? null, alreadyAgree: false, topStyles };
}
