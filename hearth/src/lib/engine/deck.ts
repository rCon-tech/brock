import type { ProjectContext } from '@/lib/context';
import type { BudgetBand, Category, RoomType } from '@/lib/taxonomy';
import { eligiblePhotos, eligibleProducts } from './constraints';
import { MACRO_COUNT, RESERVE_COUNT, quotasFor } from './quotas';
import { makeRng, type Rng } from './rng';
import type { EngineItem } from './types';
import { dot, type Vec } from './vector';

export interface DeckInput {
  roomType: RoomType;
  items: EngineItem[];
  context: ProjectContext;
  budgetBand: BudgetBand | null;
  seed: string;
  /** Items that tell us nothing because everyone agrees on them (§11.1). */
  excludeIds?: Set<string>;
  /** For a next-room project: pull half the photos from near the previous bridge (R24). */
  nearVector?: Vec | null;
}

export interface Decks {
  macro: string[];
  micro: string[];
  reserveMacro: string[];
  reserveMicro: string[];
}

const MIN_STYLES_IN_MACRO = 8;

/**
 * Farthest-point sampling: repeatedly add the candidate furthest from everything chosen so far,
 * so a handful of cards spans the whole space of tastes.
 */
function farthestPoint(
  pool: EngineItem[],
  n: number,
  rng: Rng,
  already: EngineItem[] = [],
  allow: (item: EngineItem, chosen: EngineItem[]) => boolean = () => true,
): EngineItem[] {
  const chosen: EngineItem[] = [];
  const remaining = pool.filter((p) => !already.includes(p));
  const nearest = new Map<string, number>();
  const sim = (a: EngineItem, b: EngineItem) => dot(a.embedding, b.embedding);
  for (const item of remaining) {
    nearest.set(
      item.id,
      already.reduce((m, a) => Math.max(m, sim(item, a)), -2),
    );
  }
  while (chosen.length < n && remaining.length > 0) {
    const all = [...already, ...chosen];
    const allowed = remaining.filter((r) => allow(r, all));
    const candidates = allowed.length > 0 ? allowed : remaining;
    let best: EngineItem | null = null;
    if (all.length === 0) {
      best = candidates[Math.floor(rng() * candidates.length)];
    } else {
      let bestSim = Infinity;
      for (const c of candidates) {
        const s = nearest.get(c.id)!;
        // Smaller similarity to the chosen set = further away. A tiny jitter breaks ties.
        const jittered = s + rng() * 1e-9;
        if (jittered < bestSim) {
          bestSim = jittered;
          best = c;
        }
      }
    }
    if (!best) break;
    chosen.push(best);
    remaining.splice(remaining.indexOf(best), 1);
    for (const r of remaining) {
      nearest.set(r.id, Math.max(nearest.get(r.id)!, sim(r, best)));
    }
  }
  return chosen;
}

function pickMacro(photos: EngineItem[], n: number, rng: Rng, near: Vec | null | undefined) {
  const nearCount = near ? Math.floor(n / 2) : 0;
  const nearest = near
    ? photos
        .slice()
        .sort((a, b) => dot(b.embedding, near) - dot(a.embedding, near))
        .slice(0, nearCount)
    : [];
  // Until enough styles are covered, only consider photos from a style we don't have yet.
  const rest = farthestPoint(photos, n - nearest.length, rng, nearest, (item, chosen) => {
    const have = new Set(chosen.map((x) => x.primaryStyle ?? ''));
    return have.size >= MIN_STYLES_IN_MACRO || !have.has(item.primaryStyle ?? '');
  });
  return [...nearest, ...rest];
}

export function buildDecks(input: DeckInput): Decks {
  const rng = makeRng(`${input.seed}:deck`);
  const exclude = input.excludeIds ?? new Set<string>();
  const live = input.items.filter((i) => !exclude.has(i.id));

  const photos = eligiblePhotos(live, input.roomType);
  const macro = pickMacro(photos, MACRO_COUNT, rng, input.nearVector);
  const reserveMacro = farthestPoint(photos, RESERVE_COUNT, rng, macro);

  const products = eligibleProducts(live, {
    roomType: input.roomType,
    context: input.context,
    budgetBand: input.budgetBand,
  });
  const quotas = quotasFor(
    input.roomType,
    input.context.keeping.map((k) => k.category),
  );
  const micro: EngineItem[] = [];
  let shortfall = 0;
  for (const [category, quota] of Object.entries(quotas) as [Category, number][]) {
    const pool = products.filter((p) => p.category === category);
    const picked = farthestPoint(pool, quota, rng);
    micro.push(...picked);
    shortfall += quota - picked.length;
  }
  if (shortfall > 0) {
    micro.push(...farthestPoint(products, shortfall, rng, micro));
  }
  const reserveMicro = farthestPoint(products, RESERVE_COUNT, rng, micro);

  return {
    macro: macro.map((i) => i.id),
    micro: micro.map((i) => i.id),
    reserveMacro: reserveMacro.map((i) => i.id),
    reserveMicro: reserveMicro.map((i) => i.id),
  };
}

/** Each person sees the same cards in their own order. */
export { shuffle as shuffleDeck } from './rng';
