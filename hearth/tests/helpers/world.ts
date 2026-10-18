import { computeCentroids } from '@/lib/engine/centroids';
import { buildDecks, type DeckInput, type Decks } from '@/lib/engine/deck';
import type { Centroid, EngineItem, Person, PersonSwipe } from '@/lib/engine/types';
import { EMPTY_CONTEXT } from '@/lib/context';
import { generateCatalogue, type SeedItem, type SeedOptions } from '@/lib/seed/catalogue';
import type { RoomType } from '@/lib/taxonomy';

export function toEngineItem(s: SeedItem): EngineItem {
  return {
    id: s.id,
    tier: s.tier,
    category: s.category,
    roomTypes: s.roomTypes,
    embedding: s.embedding,
    attributes: s.attributes,
    primaryStyle: s.primaryStyle,
    styleWeights: s.styleWeights,
    pricePence: s.pricePence,
    inStock: true,
    widthCm: s.widthCm,
    depthCm: s.depthCm,
    heightCm: s.heightCm,
  };
}

export interface World {
  items: EngineItem[];
  byId: Map<string, EngineItem>;
  centroids: Centroid[];
}

const cache = new Map<string, World>();

/** A synthetic catalogue; cached because generating embeddings is the slow part. */
export function world(options: SeedOptions = {}): World {
  const key = JSON.stringify(options);
  let w = cache.get(key);
  if (!w) {
    const items = generateCatalogue({ dim: 128, ...options }).map(toEngineItem);
    w = {
      items,
      byId: new Map(items.map((i) => [i.id, i])),
      centroids: computeCentroids(items),
    };
    cache.set(key, w);
  }
  return w;
}

export function decksFor(
  w: World,
  roomType: RoomType = 'living_room',
  overrides: Partial<DeckInput> = {},
): Decks {
  return buildDecks({
    roomType,
    items: w.items,
    context: EMPTY_CONTEXT,
    budgetBand: null,
    seed: 'test',
    ...overrides,
  });
}

/** A person who swipes right on every deck card for which `likes` is true. */
export function persona(
  id: string,
  w: World,
  decks: Decks,
  likes: (item: EngineItem) => boolean,
  vetoes: Person['vetoes'] = [],
): Person {
  const swipes: PersonSwipe[] = [
    ...decks.macro.map((itemId) => ({ itemId, round: 'macro' as const })),
    ...decks.micro.map((itemId) => ({ itemId, round: 'micro' as const })),
  ].map((s) => ({ ...s, value: likes(w.byId.get(s.itemId)!) ? (1 as const) : (-1 as const) }));
  return { id, name: id.toUpperCase(), swipes, vetoes };
}

export const styleIs =
  (...styles: string[]) =>
  (i: EngineItem) =>
    styles.includes(i.primaryStyle ?? '');
