import { QUOTAS } from '@/lib/engine/quotas';
import type { Category, RoomType } from '@/lib/taxonomy';

/**
 * Retailer categories are inconsistent, so products are mapped to ours by keywords in the
 * category and title. Order matters: more specific rules come first ("bedside table" before
 * "bed", "dining chair" before "chair").
 */
const RULES: [Category, RegExp][] = [
  ['bedside_table', /bedside|night\s?stand/i],
  ['dining_chair', /dining chair|kitchen chair|dining stool/i],
  ['dining_table', /dining table|kitchen table|extending table/i],
  ['sideboard', /sideboard|buffet|credenza/i],
  ['wardrobe', /wardrobe|armoire/i],
  ['coffee_table', /coffee table|nest of tables/i],
  ['side_table', /side table|end table|lamp table|console table/i],
  ['floor_lamp', /floor lamp|floor light|standard lamp|arc lamp/i],
  ['table_lamp', /table lamp|desk lamp|bedside lamp/i],
  ['ceiling_light', /pendant|ceiling light|chandelier|lampshade light|flush light/i],
  ['armchair', /armchair|accent chair|snuggler|lounge chair|wingback|tub chair|swivel chair/i],
  ['sofa', /\bsofa\b|couch|settee|loveseat|chaise/i],
  ['rug', /\brug\b|runner|\bmat\b/i],
  ['bed', /\bbed\b|bed frame|divan|ottoman bed/i],
  [
    'storage',
    /bookcase|shelf|shelving|storage|chest of drawers|tv unit|media unit|cabinet|drawers/i,
  ],
  [
    'decor',
    /vase|mirror|cushion|throw|candle|wall art|print|ornament|plant pot|picture frame|sculpture/i,
  ],
];

export function mapCategory(...texts: (string | null | undefined)[]): Category | null {
  const haystack = texts.filter(Boolean).join(' | ');
  for (const [category, pattern] of RULES) if (pattern.test(haystack)) return category;
  return null;
}

/** The rooms a category belongs in, from the deck quotas. */
export function roomsFor(category: Category): RoomType[] {
  return (Object.keys(QUOTAS) as RoomType[]).filter((room) => category in QUOTAS[room]);
}
