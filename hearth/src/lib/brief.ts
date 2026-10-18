import type { BoardView } from '@/lib/board';
import type { ItemCard } from '@/lib/catalogue/load';
import { formatPrice } from '@/lib/locale';
import {
  BUDGET_LABELS,
  COLOUR_HEX,
  CATEGORY_LABELS,
  attributeFamily,
  attributeLabel,
  type BudgetBand,
  type Category,
} from '@/lib/taxonomy';

export interface Brief {
  title: string;
  tagline: string;
  palette: { label: string; hex: string }[];
  materials: string[];
  feel: string[];
  dos: string[];
  avoids: string[];
  pieces: ItemCard[];
  notes: string[];
}

function top(attrs: string[], families: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const a of attrs)
    if (families.includes(attributeFamily(a))) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([a]) => attributeLabel(a));
}

/**
 * The one page to take to a shop or a decorator (R30). Built only from what is already on the
 * board, so it can never disagree with it.
 */
export function buildBrief(board: BoardView): Brief {
  const { result, items, naming, shopping, project } = board;
  const loved = new Set(shopping.map((s) => s.itemId));
  const pieceIds = [...new Set([...result.exactMicro, ...loved])];
  const fallbackIds = result.picks.slice(0, 6).map((p) => p.itemId);
  const pieces = (pieceIds.length > 0 ? pieceIds : fallbackIds).flatMap((id) => items[id] ?? []);

  const boardAttrs = [...pieces, ...result.picks.flatMap((p) => items[p.itemId] ?? [])].flatMap(
    (i) => i.attributes,
  );
  const ctx = project.context;
  const notes: string[] = [];
  for (const k of ctx.keeping)
    notes.push(
      `Keeping: ${[k.colour, k.material?.replace('_', ' '), CATEGORY_LABELS[k.category as Category]?.toLowerCase()].filter(Boolean).join(' ')}`,
    );
  const household = [
    ctx.household.dog && 'a dog',
    ctx.household.cat && 'a cat',
    ctx.household.youngKids && 'young children',
  ].filter(Boolean);
  if (household.length) notes.push(`Household: ${household.join(', ')}`);
  for (const m of ctx.maxSize) {
    const dims = [m.widthCm && `${m.widthCm} cm wide`, m.depthCm && `${m.depthCm} cm deep`]
      .filter(Boolean)
      .join(', ');
    notes.push(
      `Space: ${CATEGORY_LABELS[m.category as Category]?.toLowerCase()} no more than ${dims}`,
    );
  }
  if (project.budgetBand) {
    notes.push(
      `Budget: ${BUDGET_LABELS[project.budgetBand as BudgetBand]}${board.total.budgetPence ? ` (about ${formatPrice(board.total.budgetPence)} for the room)` : ''}`,
    );
  }

  return {
    title: naming.name,
    tagline: naming.tagline,
    palette: result.palette.map((c) => ({
      label: attributeLabel(c),
      hex: COLOUR_HEX[c] ?? '#cccccc',
    })),
    materials: result.materials.map(attributeLabel),
    feel: [...top(boardAttrs, ['line', 'finish', 'mood'], 5)],
    dos: result.shared.map((s) => attributeLabel(s.attribute)),
    avoids: result.vetoedAttributes.map(attributeLabel),
    pieces,
    notes,
  };
}
