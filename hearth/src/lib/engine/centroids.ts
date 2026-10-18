import type { Centroid, EngineItem } from './types';
import { normalise, weightedMean } from './vector';

/** Weighted mean embedding per style over items that are mostly that style (weight ≥ 0.5). */
export function computeCentroids(
  items: EngineItem[],
  minItems = 1,
): (Centroid & { count: number })[] {
  const bySlug = new Map<string, { v: number[]; w: number }[]>();
  for (const item of items) {
    for (const [slug, weight] of Object.entries(item.styleWeights)) {
      if (weight < 0.5) continue;
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), { v: item.embedding, w: weight }]);
    }
  }
  const out: (Centroid & { count: number })[] = [];
  for (const [slug, vectors] of bySlug) {
    if (vectors.length < minItems) continue;
    const mean = weightedMean(vectors);
    if (mean) out.push({ slug, vector: normalise(mean), count: vectors.length });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
