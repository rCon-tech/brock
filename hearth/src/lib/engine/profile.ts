import { attributeFamily, attributeLabel, styleLabel } from '@/lib/taxonomy';
import type { Centroid, EngineItem, Person } from './types';
import { cosine, normalise, weightedMean, type Vec } from './vector';

const MACRO_WEIGHT = 1.5;
/** Fewer than this many exposures and an attribute says nothing yet. */
const MIN_EXPOSURES = 2;
/**
 * Affinity is the lift in a person's right-swipe rate on cards carrying an attribute, over their
 * own overall rate, smoothed towards zero by PRIOR pseudo-swipes. Measuring against the person's
 * own baseline means someone who says yes to everything doesn't "love" every attribute, and two
 * people with different tastes can still share an element.
 */
const PRIOR = 1;
export const LOVE_THRESHOLD = 0.12;

export interface Profile {
  personId: string;
  name: string;
  taste: Vec | null;
  /** `family:value` -> lift over this person's own baseline right-swipe rate, in −1..+1. */
  affinity: Map<string, number>;
  topStyles: { style: string; score: number }[];
  /** Share of macro swipes consistent with the top style's direction. */
  confidence: number;
  likedIds: string[];
  dislikedIds: string[];
  /** Item ids this person has seen (swiped or vetoed). */
  seenIds: Set<string>;
}

interface Verdict {
  item: EngineItem;
  value: 1 | -1;
  weight: number;
}

/**
 * Turns one person's swipes and vetoes into a taste vector (Rocchio-style: mean of the liked
 * cards minus half the mean of the disliked ones), attribute affinities and top styles.
 */
export function buildProfile(
  person: Person,
  itemsById: Map<string, EngineItem>,
  centroids: Centroid[],
): Profile {
  const verdicts = new Map<string, Verdict>();
  for (const s of person.swipes) {
    const item = itemsById.get(s.itemId);
    if (!item) continue;
    verdicts.set(s.itemId, {
      item,
      value: s.value,
      weight: item.tier === 'macro' ? MACRO_WEIGHT : 1,
    });
  }
  // A veto is a left swipe even if the card was never swiped.
  for (const v of person.vetoes) {
    const item = itemsById.get(v.itemId);
    if (!item) continue;
    verdicts.set(v.itemId, { item, value: -1, weight: item.tier === 'macro' ? MACRO_WEIGHT : 1 });
  }

  const liked: { v: Vec; w: number }[] = [];
  const disliked: { v: Vec; w: number }[] = [];
  const counts = new Map<string, { n: number; k: number }>();
  for (const { item, value, weight } of verdicts.values()) {
    (value === 1 ? liked : disliked).push({ v: item.embedding, w: weight });
    for (const attr of item.attributes) {
      const c = counts.get(attr) ?? { n: 0, k: 0 };
      c.n++;
      if (value === 1) c.k++;
      counts.set(attr, c);
    }
  }

  const likedMean = weightedMean(liked);
  const dislikedMean = weightedMean(disliked);
  let taste: Vec | null = null;
  if (likedMean && dislikedMean) {
    taste = normalise(likedMean.map((x, i) => x - 0.5 * dislikedMean[i]));
  } else if (likedMean) {
    taste = normalise(likedMean);
  } else if (dislikedMean) {
    taste = normalise(dislikedMean.map((x) => -x));
  }

  const baseline = verdicts.size === 0 ? 0.5 : likedCount(verdicts) / verdicts.size;
  const affinity = new Map<string, number>();
  for (const [attr, { n, k }] of counts) {
    if (n >= MIN_EXPOSURES) {
      affinity.set(attr, (k + baseline * PRIOR) / (n + PRIOR) - baseline);
    }
  }
  // A named deal-breaker is as negative as an attribute can be (R9).
  for (const v of person.vetoes) if (v.attribute) affinity.set(v.attribute, -0.5);

  const topStyles = taste
    ? centroids
        .map((c) => ({ style: c.slug, score: cosine(taste, c.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  return {
    personId: person.id,
    name: person.name,
    taste,
    affinity,
    topStyles,
    confidence: macroConfidence(verdicts, centroids, topStyles[0]?.style),
    likedIds: [...verdicts].filter(([, v]) => v.value === 1).map(([id]) => id),
    dislikedIds: [...verdicts].filter(([, v]) => v.value === -1).map(([id]) => id),
    seenIds: new Set(verdicts.keys()),
  };
}

function likedCount(verdicts: Map<string, Verdict>): number {
  let n = 0;
  for (const v of verdicts.values()) if (v.value === 1) n++;
  return n;
}

function macroConfidence(
  verdicts: Map<string, Verdict>,
  centroids: Centroid[],
  topStyle: string | undefined,
): number {
  const centroid = centroids.find((c) => c.slug === topStyle);
  const macros = [...verdicts.values()].filter((v) => v.item.tier === 'macro');
  if (!centroid || macros.length === 0) return 0;
  const sims = macros.map((m) => cosine(m.item.embedding, centroid.vector));
  const avg = sims.reduce((a, b) => a + b, 0) / sims.length;
  const consistent = macros.filter((m, i) => (m.value === 1 ? sims[i] >= avg : sims[i] < avg));
  return consistent.length / macros.length;
}

/** Mean affinity over an item's non-practical attributes (unknown attributes count as 0). */
export function meanAffinity(profile: Profile, attributes: readonly string[]): number {
  const relevant = attributes.filter((a) => attributeFamily(a) !== 'practical');
  if (relevant.length === 0) return 0;
  return relevant.reduce((s, a) => s + (profile.affinity.get(a) ?? 0), 0) / relevant.length;
}

/** The text behind the personal style card (R23): "You lean Japandi, with a soft spot for brass". */
export function describeTaste(profile: Profile): { style: string | null; softSpots: string[] } {
  const softSpots = [...profile.affinity]
    .filter(([a, v]) => v >= LOVE_THRESHOLD && attributeFamily(a) !== 'practical')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([a]) => attributeLabel(a));
  return { style: profile.topStyles[0]?.style ?? null, softSpots };
}

export function tasteSentence(profile: Profile): string {
  const { style, softSpots } = describeTaste(profile);
  if (!style) return 'Swipe a few more cards to see your style.';
  const lean = `You lean ${styleLabel(style)}`;
  return softSpots.length
    ? `${lean}, with a soft spot for ${softSpots.join(' and ')}.`
    : `${lean}.`;
}
