import type { BudgetBand, Category } from '@/lib/taxonomy';

/** Highest price (in pence) a band allows per category. `high` has no cap. */
const LOW_CAPS: Record<Category, number> = {
  sofa: 80000,
  armchair: 40000,
  coffee_table: 25000,
  rug: 20000,
  ceiling_light: 12000,
  floor_lamp: 10000,
  table_lamp: 8000,
  storage: 40000,
  side_table: 12000,
  decor: 6000,
  bed: 60000,
  bedside_table: 15000,
  wardrobe: 50000,
  dining_table: 60000,
  dining_chair: 8000,
  sideboard: 40000,
};
const MID_FACTOR = 2.5;

export function priceCapPence(band: BudgetBand | null | undefined, category: string): number {
  if (!band || band === 'high') return Number.POSITIVE_INFINITY;
  const low = LOW_CAPS[category as Category] ?? 30000;
  return band === 'low' ? low : low * MID_FACTOR;
}

/** Whole-room budget used for the shopping-list total (R34). `null` = no ceiling. */
export const ROOM_BUDGET_PENCE: Record<BudgetBand, number | null> = {
  low: 150000,
  mid: 400000,
  high: null,
};
