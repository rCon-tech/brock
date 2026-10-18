import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { catalogueItem } from '@/db/schema';
import { embedItems, embeddingText } from '@/lib/embeddings/voyage';
import { args, need, run } from './args';

// pnpm catalogue:embed [--limit 500]
// Embeds tagged items (image plus a short description) so "similar" can be measured.
run(async () => {
  const key = need('VOYAGE_API_KEY');
  const limit = Number(args().limit ?? 500);
  const db = await getDb();
  const items = await db
    .select()
    .from(catalogueItem)
    .where(
      and(
        isNotNull(catalogueItem.taggedAt),
        isNull(catalogueItem.embeddedAt),
        ne(catalogueItem.status, 'retired'),
      ),
    )
    .orderBy(asc(catalogueItem.createdAt))
    .limit(limit);
  if (items.length === 0) return console.log('Nothing to embed.');

  const vectors = await embedItems(
    items.map((i) => ({ imageUrl: i.imageUrl, text: embeddingText(i) })),
    key,
  );
  for (const [i, item] of items.entries()) {
    await db
      .update(catalogueItem)
      .set({ embedding: vectors[i], embeddedAt: new Date() })
      .where(eq(catalogueItem.id, item.id));
  }
  console.log(`Embedded ${items.length} items.`);
});
