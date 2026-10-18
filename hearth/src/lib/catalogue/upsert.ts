import { and, eq, notInArray, sql } from 'drizzle-orm';
import { catalogueItem, retailer } from '@/db/schema';
import type { Db } from '@/db';
import { clearCatalogueCache } from '@/lib/catalogue/load';
import type { FeedItem } from './feeds';

/** An item missing from the feed this many nights running is retired (§10.4). */
export const RETIRE_AFTER_NIGHTS = 3;

/**
 * Adds or refreshes products from a feed. New items arrive as `draft` for review; existing ones
 * keep their status and tags and only get their price, stock and links refreshed.
 */
export async function upsertFeedItems(
  db: Db,
  merchant: { id: string; name: string },
  items: FeedItem[],
): Promise<{ created: number; updated: number }> {
  await db
    .insert(retailer)
    .values({ id: merchant.id, name: merchant.name, network: 'awin' })
    .onConflictDoNothing();
  const existing = new Set(
    (
      await db
        .select({ id: catalogueItem.sourceId })
        .from(catalogueItem)
        .where(eq(catalogueItem.source, 'awin'))
    ).map((r) => r.id),
  );
  let created = 0;
  for (const i of items) {
    const sourceId = `${merchant.id}:${i.sourceId}`;
    if (!existing.has(sourceId)) created++;
    await db
      .insert(catalogueItem)
      .values({
        id: `awin-${merchant.id}-${i.sourceId}`.slice(0, 64),
        tier: 'micro',
        roomTypes: i.roomTypes,
        category: i.category,
        title: i.title,
        description: i.description,
        imageUrl: i.imageUrl,
        extraImages: i.extraImages,
        source: 'awin',
        sourceId,
        retailerId: merchant.id,
        pricePence: i.pricePence,
        currency: i.currency,
        productUrl: i.productUrl,
        affiliateUrl: i.affiliateUrl,
        inStock: i.inStock,
        widthCm: i.widthCm,
        depthCm: i.depthCm,
        heightCm: i.heightCm,
        lastSeenInFeedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [catalogueItem.source, catalogueItem.sourceId],
        set: {
          pricePence: i.pricePence,
          inStock: i.inStock,
          affiliateUrl: i.affiliateUrl,
          productUrl: i.productUrl,
          imageUrl: i.imageUrl,
          lastSeenInFeedAt: new Date(),
        },
      });
  }
  clearCatalogueCache();
  return { created, updated: items.length - created };
}

/** Retires products a merchant's feed has stopped listing. Returns how many were retired. */
export async function retireMissing(
  db: Db,
  merchantId: string,
  seen: string[],
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - RETIRE_AFTER_NIGHTS * 86_400_000);
  const seenIds = seen.map((s) => `${merchantId}:${s}`);
  const gone = await db
    .update(catalogueItem)
    .set({ status: 'retired' })
    .where(
      and(
        eq(catalogueItem.retailerId, merchantId),
        eq(catalogueItem.source, 'awin'),
        sql`${catalogueItem.status} <> 'retired'`,
        sql`${catalogueItem.lastSeenInFeedAt} < ${cutoff}`,
        seenIds.length ? notInArray(catalogueItem.sourceId, seenIds) : sql`true`,
      ),
    )
    .returning({ id: catalogueItem.id });
  if (gone.length) clearCatalogueCache();
  return gone.length;
}
