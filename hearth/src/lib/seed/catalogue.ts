import { makeRng, type Rng } from '@/lib/engine/rng';
import { addScaled, normalise, zeros } from '@/lib/engine/vector';
import {
  CATEGORY_LABELS,
  COLOUR_HEX,
  EMBEDDING_DIM,
  ROOM_LABELS,
  STYLES,
  attributeLabel,
  styleLabel,
  type Category,
  type RoomType,
  type StyleSlug,
} from '@/lib/taxonomy';
import { QUOTAS } from '@/lib/engine/quotas';
import { STYLE_PROFILES } from './styles';

export interface SeedItem {
  id: string;
  tier: 'macro' | 'micro';
  roomTypes: RoomType[];
  category: Category | null;
  title: string;
  description: string;
  imageUrl: string;
  extraImages: string[];
  attributes: string[];
  primaryStyle: StyleSlug;
  styleWeights: Record<string, number>;
  pricePence: number | null;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  embedding: number[];
}

export interface SeedOptions {
  seed?: string;
  styles?: readonly StyleSlug[];
  roomTypes?: readonly RoomType[];
  /** Photos per style per room type. */
  macroPerStyle?: number;
  /** Products per category per style. */
  microPerCategoryPerStyle?: number;
  dim?: number;
}

const BASE_PRICE: Record<Category, number> = {
  sofa: 90000,
  armchair: 40000,
  coffee_table: 22000,
  rug: 20000,
  ceiling_light: 9000,
  floor_lamp: 9000,
  table_lamp: 6000,
  storage: 30000,
  side_table: 9000,
  decor: 4500,
  bed: 70000,
  bedside_table: 12000,
  wardrobe: 50000,
  dining_table: 55000,
  dining_chair: 9000,
  sideboard: 38000,
};

const BASE_DIMS: Record<Category, [number, number, number]> = {
  sofa: [210, 92, 85],
  armchair: [80, 85, 85],
  coffee_table: [100, 60, 40],
  rug: [200, 300, 1],
  ceiling_light: [50, 50, 40],
  floor_lamp: [40, 40, 160],
  table_lamp: [25, 25, 45],
  storage: [120, 40, 90],
  side_table: [45, 45, 50],
  decor: [30, 30, 30],
  bed: [160, 210, 100],
  bedside_table: [45, 40, 55],
  wardrobe: [120, 60, 200],
  dining_table: [160, 90, 75],
  dining_chair: [45, 50, 85],
  sideboard: [160, 45, 80],
};

const LUXE = new Set<StyleSlug>(['art_deco', 'hollywood_regency', 'maximalist', 'traditional']);
const FABRIC_CATEGORIES = new Set<Category>(['sofa', 'armchair', 'bed', 'dining_chair']);
const LIGHT_COLOURS = new Set(['white', 'cream', 'beige', 'blush']);

function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function randomUnit(seed: string, dim: number): number[] {
  const rng = makeRng(seed);
  return normalise(Array.from({ length: dim }, () => gaussian(rng)));
}

function pick<T>(rng: Rng, values: readonly T[], n = 1): T[] {
  const pool = values.slice();
  const out: T[] = [];
  while (out.length < n && pool.length)
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export function placeholderUrl(title: string, attributes: string[]): string {
  const colours = attributes.filter((a) => a.startsWith('colour:')).map((a) => COLOUR_HEX[a]);
  const [c1, c2] = [colours[0] ?? '#cfc7b8', colours[1] ?? colours[0] ?? '#8c8579'];
  const q = new URLSearchParams({ t: title, a: c1, b: c2 });
  return `/api/placeholder?${q.toString()}`;
}

/**
 * A synthetic catalogue whose embeddings cluster by style (warm_minimal sits between industrial
 * and minimalist), so the engine can be developed and tested with no API keys or network.
 */
export function generateCatalogue(options: SeedOptions = {}): SeedItem[] {
  const seed = options.seed ?? 'hearth';
  const dim = options.dim ?? EMBEDDING_DIM;
  const styles = options.styles ?? STYLES;
  const roomTypes = options.roomTypes ?? (Object.keys(QUOTAS) as RoomType[]);
  const macroPerStyle = options.macroPerStyle ?? 3;
  const microPer = options.microPerCategoryPerStyle ?? 1;

  const anchors = new Map<string, number[]>();
  const anchor = (style: string): number[] => {
    if (!anchors.has(style)) {
      anchors.set(
        style,
        style === 'warm_minimal'
          ? normalise(
              randomUnit(`${seed}:style:industrial`, dim).map(
                (x, i) => x + randomUnit(`${seed}:style:minimalist`, dim)[i],
              ),
            )
          : randomUnit(`${seed}:style:${style}`, dim),
      );
    }
    return anchors.get(style)!;
  };
  const attrVecs = new Map<string, number[]>();
  const attrVec = (a: string) => {
    if (!attrVecs.has(a)) attrVecs.set(a, randomUnit(`${seed}:attr:${a}`, dim));
    return attrVecs.get(a)!;
  };

  const build = (
    id: string,
    tier: 'macro' | 'micro',
    style: StyleSlug,
    rooms: RoomType[],
    category: Category | null,
    rng: Rng,
  ): SeedItem => {
    const prof = STYLE_PROFILES[style];
    const attributes = [
      ...pick(rng, prof.materials, 2).map((m) => `material:${m}`),
      ...pick(rng, prof.colours, rng() < 0.5 ? 2 : 1).map((c) => `colour:${c}`),
      ...pick(rng, prof.lines, 1).map((l) => `line:${l}`),
      ...pick(rng, prof.finishes, 1).map((f) => `finish:${f}`),
      ...pick(rng, prof.moods, 1).map((m) => `mood:${m}`),
    ];
    // Practical risks follow from what the item is made of.
    const has = (a: string) => attributes.includes(a);
    if (
      category &&
      FABRIC_CATEGORIES.has(category) &&
      attributes.some((a) => LIGHT_COLOURS.has(a.slice(7)) && a.startsWith('colour:')) &&
      (has('material:boucle') ||
        has('material:linen') ||
        has('material:velvet') ||
        has('material:wool'))
    ) {
      attributes.push('practical:light_fabric');
    }
    if (category === 'rug' && (has('material:wool') || has('material:jute')))
      attributes.push('practical:loop_pile');
    if (
      (category === 'coffee_table' || category === 'side_table' || category === 'dining_table') &&
      has('material:glass')
    ) {
      attributes.push('practical:glass_top');
    }
    if (category && has('material:marble') && category !== 'rug')
      attributes.push('practical:sharp_corners');
    if (has('finish:gloss') && category && FABRIC_CATEGORIES.has(category))
      attributes.push('practical:high_maintenance');

    const neighbour = pick(
      rng,
      styles.filter((s) => s !== style),
      1,
    )[0];
    const neighbourWeight = neighbour ? 0.15 + rng() * 0.25 : 0;
    const v = zeros(dim);
    addScaled(v, anchor(style), 1);
    if (neighbour) addScaled(v, anchor(neighbour), neighbourWeight);
    for (const a of attributes) if (!a.startsWith('practical:')) addScaled(v, attrVec(a), 0.25);
    const noise = Array.from({ length: dim }, () => gaussian(rng));
    addScaled(v, normalise(noise), 0.45);

    const prefix = prof.names[Math.floor(rng() * prof.names.length)];
    const material = attributes.find((a) => a.startsWith('material:'))!;
    const title =
      tier === 'micro'
        ? `${prefix} ${attributeLabel(material)} ${CATEGORY_LABELS[category!].toLowerCase()}`
        : `${styleLabel(style)} ${ROOM_LABELS[rooms[0]].toLowerCase()}`;
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const finalTitle = cap(title);

    let price: number | null = null;
    let dims: [number | null, number | null, number | null] = [null, null, null];
    if (tier === 'micro') {
      price =
        Math.round(
          (BASE_PRICE[category!] * (0.4 + rng() * 2) * (LUXE.has(style) ? 1.5 : 1)) / 100,
        ) * 100;
      if (rng() < 0.7) {
        const scale = 0.8 + rng() * 0.45;
        const [w, d, h] = BASE_DIMS[category!];
        dims = [Math.round(w * scale), Math.round(d * scale), Math.round(h * scale)];
      }
    }
    const imageUrl = placeholderUrl(finalTitle, attributes);
    return {
      id,
      tier,
      roomTypes: rooms,
      category,
      title: finalTitle,
      description: `${finalTitle}. ${styleLabel(style)} style in ${attributes
        .filter((a) => !a.startsWith('practical:'))
        .slice(0, 3)
        .map(attributeLabel)
        .join(', ')}.`,
      imageUrl,
      extraImages: tier === 'micro' ? [imageUrl, imageUrl] : [],
      attributes,
      primaryStyle: style,
      styleWeights: {
        [style]: 1,
        ...(neighbour ? { [neighbour]: Math.round(neighbourWeight * 100) / 100 } : {}),
      },
      pricePence: price,
      widthCm: dims[0],
      depthCm: dims[1],
      heightCm: dims[2],
      embedding: normalise(v),
    };
  };

  const items: SeedItem[] = [];
  for (const room of roomTypes) {
    for (const style of styles) {
      for (let i = 0; i < macroPerStyle; i++) {
        const id = `seed-macro-${style}-${room}-${i}`;
        items.push(build(id, 'macro', style, [room], null, makeRng(`${seed}:${id}`)));
      }
    }
  }
  const categories = new Map<Category, RoomType[]>();
  for (const room of roomTypes) {
    for (const category of Object.keys(QUOTAS[room]) as Category[]) {
      categories.set(category, [...(categories.get(category) ?? []), room]);
    }
  }
  for (const [category, rooms] of categories) {
    for (const style of styles) {
      for (let i = 0; i < microPer; i++) {
        const id = `seed-micro-${style}-${category}-${i}`;
        items.push(build(id, 'micro', style, rooms, category, makeRng(`${seed}:${id}`)));
      }
    }
  }
  return items;
}
