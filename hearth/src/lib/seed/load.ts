import { count, sql } from 'drizzle-orm';
import { catalogueItem, retailer, style } from '@/db/schema';
import type { Db } from '@/db';
import { computeCentroids } from '@/lib/engine/centroids';
import { clearCatalogueCache } from '@/lib/catalogue/load';
import { STYLES, styleLabel } from '@/lib/taxonomy';
import { generateCatalogue, type SeedOptions } from './catalogue';

const SEED_RETAILER = 'seed-home';
const BATCH = 50;

/** Inserts a synthetic, already-tagged and already-embedded catalogue marked live. */
export async function seedCatalogue(db: Db, options: SeedOptions = {}): Promise<number> {
  const items = generateCatalogue(options);
  await db
    .insert(retailer)
    .values({ id: SEED_RETAILER, name: 'Seed Home', network: 'manual' })
    .onConflictDoNothing();

  // Building the vector index once at the end is much faster than updating it row by row.
  await db.execute(sql`drop index if exists catalogue_item_embedding_idx`);
  for (let i = 0; i < items.length; i += BATCH) {
    await db
      .insert(catalogueItem)
      .values(
        items.slice(i, i + BATCH).map((s) => ({
          id: s.id,
          tier: s.tier,
          roomTypes: s.roomTypes,
          category: s.category,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl,
          extraImages: s.extraImages,
          source: 'seed' as const,
          sourceId: s.id,
          retailerId: s.tier === 'micro' ? SEED_RETAILER : null,
          pricePence: s.pricePence,
          productUrl: s.tier === 'micro' ? `https://example.com/p/${s.id}` : null,
          affiliateUrl: s.tier === 'micro' ? `https://example.com/p/${s.id}?aff=hearth` : null,
          widthCm: s.widthCm,
          depthCm: s.depthCm,
          heightCm: s.heightCm,
          status: 'live' as const,
          attributes: s.attributes,
          primaryStyle: s.primaryStyle,
          styleWeights: s.styleWeights,
          embedding: s.embedding,
          taggedAt: new Date(),
          embeddedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  }

  await db.execute(
    sql`create index if not exists catalogue_item_embedding_idx on catalogue_item using hnsw (embedding vector_cosine_ops)`,
  );

  const centroids = computeCentroids(
    items.map((s) => ({
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
    })),
  );
  for (const c of centroids) {
    await db
      .insert(style)
      .values({ slug: c.slug, name: styleLabel(c.slug), centroid: c.vector, itemCount: c.count })
      .onConflictDoUpdate({
        target: style.slug,
        set: { centroid: c.vector, itemCount: c.count },
      });
  }
  clearCatalogueCache();
  return items.length;
}

/** Development convenience: an empty PGlite database gets the default synthetic catalogue. */
export async function seedIfEmpty(db: Db, options: SeedOptions = {}): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(catalogueItem);
  if (n > 0) return false;
  await seedCatalogue(db, { microPerCategoryPerStyle: 2, styles: STYLES, ...options });
  return true;
}
