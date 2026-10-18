import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { catalogueItem, style } from '@/db/schema';
import { toEngineItem } from '@/lib/catalogue/load';
import { computeCentroids } from '@/lib/engine/centroids';
import { styleLabel } from '@/lib/taxonomy';
import { run } from './args';

const MIN_ITEMS = 15;

// Recomputes each style's centre from the live, embedded items. Run after embedding or approving
// items. A style with too few items gives a shaky bridge, so it is flagged.
run(async () => {
  const db = await getDb();
  const rows = await db.select().from(catalogueItem).where(eq(catalogueItem.status, 'live'));
  const items = rows.filter((r) => r.embedding?.length).map(toEngineItem);
  const centroids = computeCentroids(items);
  for (const c of centroids) {
    await db
      .insert(style)
      .values({ slug: c.slug, name: styleLabel(c.slug), centroid: c.vector, itemCount: c.count })
      .onConflictDoUpdate({ target: style.slug, set: { centroid: c.vector, itemCount: c.count } });
    console.log(
      `${c.slug.padEnd(20)} ${String(c.count).padStart(4)} items${c.count < MIN_ITEMS ? '   ⚠ fewer than 15' : ''}`,
    );
  }
  console.log(`${centroids.length} style centres from ${items.length} items.`);
});
