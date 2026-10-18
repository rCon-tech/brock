import { priceCapPence } from '@/lib/budget';
import type { ProjectContext } from '@/lib/context';
import type { BudgetBand } from '@/lib/taxonomy';
import type { EngineItem } from './types';

export interface ConstraintOptions {
  roomType: string;
  context: ProjectContext;
  budgetBand: BudgetBand | null;
}

/** True when a size limit applies to this item's category but the item has no dimensions. */
export function sizeUnknown(item: EngineItem, context: ProjectContext): boolean {
  const limit = context.maxSize.find((m) => m.category === item.category);
  if (!limit) return false;
  const needsWidth = limit.widthCm != null && item.widthCm == null;
  const needsDepth = limit.depthCm != null && item.depthCm == null;
  return needsWidth || needsDepth;
}

function fitsSize(item: EngineItem, context: ProjectContext): boolean {
  const limit = context.maxSize.find((m) => m.category === item.category);
  if (!limit) return true;
  if (limit.widthCm != null && item.widthCm != null && item.widthCm > limit.widthCm) return false;
  if (limit.depthCm != null && item.depthCm != null && item.depthCm > limit.depthCm) return false;
  return true;
}

/**
 * Items eligible for the micro deck and compromise picks: this room type, in stock, within
 * budget, fitting the size limits, and not in a category the household is keeping.
 */
export function eligibleProducts(items: EngineItem[], opts: ConstraintOptions): EngineItem[] {
  const kept = new Set(opts.context.keeping.map((k) => k.category as string));
  return items.filter(
    (i) =>
      i.tier === 'micro' &&
      i.inStock &&
      i.roomTypes.includes(opts.roomType) &&
      i.category != null &&
      !kept.has(i.category) &&
      (i.pricePence == null || i.pricePence <= priceCapPence(opts.budgetBand, i.category)) &&
      fitsSize(i, opts.context),
  );
}

export function eligiblePhotos(items: EngineItem[], roomType: string): EngineItem[] {
  return items.filter((i) => i.tier === 'macro' && i.roomTypes.includes(roomType));
}
