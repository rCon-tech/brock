import type { Category, RoomType } from '@/lib/taxonomy';

export const MACRO_COUNT = 12;
export const MICRO_COUNT = 18;
export const RESERVE_COUNT = 2;

/** Micro deck composition per room type. Each must sum to MICRO_COUNT. */
export const QUOTAS: Record<RoomType, Partial<Record<Category, number>>> = {
  living_room: {
    sofa: 3,
    armchair: 2,
    coffee_table: 2,
    rug: 3,
    ceiling_light: 1,
    floor_lamp: 1,
    table_lamp: 1,
    storage: 2,
    side_table: 1,
    decor: 2,
  },
  bedroom: {
    bed: 3,
    bedside_table: 2,
    wardrobe: 2,
    rug: 3,
    ceiling_light: 2,
    table_lamp: 2,
    armchair: 1,
    storage: 2,
    decor: 1,
  },
  dining_room: {
    dining_table: 3,
    dining_chair: 4,
    sideboard: 3,
    rug: 2,
    ceiling_light: 3,
    decor: 2,
    storage: 1,
  },
};

/**
 * Quota with kept categories removed (R14). Their share is spread across the remaining
 * categories, largest first, so the deck keeps its size.
 */
export function quotasFor(
  roomType: RoomType,
  kept: readonly Category[],
  total = MICRO_COUNT,
): Partial<Record<Category, number>> {
  const base = QUOTAS[roomType];
  const keptSet = new Set<Category>(kept);
  const out: Partial<Record<Category, number>> = {};
  let used = 0;
  for (const [cat, n] of Object.entries(base) as [Category, number][]) {
    if (keptSet.has(cat)) continue;
    out[cat] = n;
    used += n;
  }
  const cats = (Object.keys(out) as Category[]).sort((a, b) => out[b]! - out[a]!);
  if (cats.length === 0) return out;
  let i = 0;
  while (used < total) {
    const cat = cats[i % cats.length];
    out[cat] = (out[cat] ?? 0) + 1;
    used++;
    i++;
  }
  return out;
}
