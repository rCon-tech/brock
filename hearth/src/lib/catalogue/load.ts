import { and, eq, inArray, sql } from 'drizzle-orm';
import { catalogueItem, itemStats, style } from '@/db/schema';
import type { Db } from '@/db';
import { computeCentroids } from '@/lib/engine/centroids';
import type { Centroid, EngineItem } from '@/lib/engine/types';
import { normalise } from '@/lib/engine/vector';

type Row = typeof catalogueItem.$inferSelect;

export function toEngineItem(row: Row): EngineItem {
  return {
    id: row.id,
    tier: row.tier,
    category: row.category,
    roomTypes: row.roomTypes,
    embedding: normalise(row.embedding ?? []),
    attributes: row.attributes,
    primaryStyle: row.primaryStyle,
    styleWeights: row.styleWeights ?? (row.primaryStyle ? { [row.primaryStyle]: 1 } : {}),
    pricePence: row.pricePence,
    inStock: row.inStock,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    heightCm: row.heightCm,
  };
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; items: EngineItem[] }>();

export function clearCatalogueCache(): void {
  cache.clear();
}

/** Live items for a room type with embeddings, cached briefly (they change nightly at most). */
export async function loadEngineItems(db: Db, roomType: string): Promise<EngineItem[]> {
  const hit = cache.get(roomType);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items;
  const rows = await db
    .select()
    .from(catalogueItem)
    .where(
      and(
        eq(catalogueItem.status, 'live'),
        sql`${catalogueItem.roomTypes} @> ARRAY[${roomType}]::text[]`,
      ),
    );
  const items = rows.filter((r) => r.embedding && r.embedding.length > 0).map(toEngineItem);
  cache.set(roomType, { at: Date.now(), items });
  return items;
}

/**
 * Items referenced by a board or a deck may have been retired since, so they're loaded by id
 * regardless of status, and without their (large) embeddings.
 */
export async function loadEngineItemsById(db: Db, ids: string[]): Promise<EngineItem[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(catalogueItem).where(inArray(catalogueItem.id, ids));
  return rows.filter((r) => r.embedding && r.embedding.length > 0).map(toEngineItem);
}

/** Style centroids from the `style` table, or computed from live items if it's empty. */
export async function loadCentroids(db: Db, items: EngineItem[]): Promise<Centroid[]> {
  const rows = await db.select().from(style);
  const stored = rows
    .filter((r) => r.centroid && r.centroid.length > 0)
    .map((r) => ({ slug: r.slug, vector: normalise(r.centroid!) }));
  return stored.length > 0 ? stored : computeCentroids(items);
}

const MIN_STATS_EXPOSURES = 50;

/** Cards almost everyone agrees on tell us nothing, so decks skip them (§11.1). */
export async function loadUninformativeIds(db: Db): Promise<Set<string>> {
  const rows = await db.select().from(itemStats);
  return new Set(
    rows
      .filter((r) => {
        if (r.exposures < MIN_STATS_EXPOSURES) return false;
        const rate = r.rights / r.exposures;
        return rate > 0.9 || rate < 0.1;
      })
      .map((r) => r.itemId),
  );
}

/** How well an item does in tie-breakers vs the average, smoothed so new items aren't punished. */
export async function loadStatsBoost(db: Db): Promise<Map<string, number>> {
  const rows = await db.select().from(itemStats);
  const shown = rows.reduce((s, r) => s + r.tiebreakShown, 0);
  const yes = rows.reduce((s, r) => s + r.tiebreakMutualYes, 0);
  const global = shown > 0 ? yes / shown : 0;
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.tiebreakShown === 0) continue;
    out.set(r.itemId, (r.tiebreakMutualYes + global * 4) / (r.tiebreakShown + 4) - global);
  }
  return out;
}

/** What the UI needs to draw a card: no embeddings. */
export interface ItemCard {
  id: string;
  tier: 'macro' | 'micro';
  category: string | null;
  title: string;
  description: string | null;
  imageUrl: string;
  extraImages: string[];
  attributes: string[];
  primaryStyle: string | null;
  pricePence: number | null;
  retailer: string | null;
  inStock: boolean;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  attributionName: string | null;
  attributionUrl: string | null;
}

export async function loadItemCards(db: Db, ids: string[]): Promise<Map<string, ItemCard>> {
  const out = new Map<string, ItemCard>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      id: catalogueItem.id,
      tier: catalogueItem.tier,
      category: catalogueItem.category,
      title: catalogueItem.title,
      description: catalogueItem.description,
      imageUrl: catalogueItem.imageUrl,
      extraImages: catalogueItem.extraImages,
      attributes: catalogueItem.attributes,
      primaryStyle: catalogueItem.primaryStyle,
      pricePence: catalogueItem.pricePence,
      retailerId: catalogueItem.retailerId,
      inStock: catalogueItem.inStock,
      widthCm: catalogueItem.widthCm,
      depthCm: catalogueItem.depthCm,
      heightCm: catalogueItem.heightCm,
      attributionName: catalogueItem.attributionName,
      attributionUrl: catalogueItem.attributionUrl,
    })
    .from(catalogueItem)
    .where(inArray(catalogueItem.id, ids));
  for (const r of rows) {
    const { retailerId, ...rest } = r;
    out.set(r.id, { ...rest, retailer: retailerId });
  }
  return out;
}

const MIN_PHOTOS = 12;
const MIN_PRODUCTS = 18;

/** Room types with enough live cards to build a deck, so we never offer a room we can't serve. */
export async function availableRoomTypes(db: Db, candidates: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const room of candidates) {
    const items = await loadEngineItems(db, room);
    const photos = items.filter((i) => i.tier === 'macro').length;
    const products = items.filter((i) => i.tier === 'micro').length;
    if (photos >= MIN_PHOTOS && products >= MIN_PRODUCTS) out.push(room);
  }
  return out;
}
