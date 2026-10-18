import { getDb } from '@/db';
import { catalogueItem } from '@/db/schema';
import { ROOM_TYPES, type RoomType } from '@/lib/taxonomy';
import { searchPhotos, suitable, toCatalogueRow } from '@/lib/unsplash';
import { args, need, run } from './args';

// pnpm catalogue:photos --room living_room --query "scandinavian living room" --pages 3
// Adds portrait room photos as drafts to review in the admin, with the photographer's credit.
run(async () => {
  const a = args();
  const room = a.room as RoomType;
  if (!ROOM_TYPES.includes(room) || typeof a.query !== 'string') {
    console.error(`Usage: --room <${ROOM_TYPES.join('|')}> --query "<search words>" [--pages 3]`);
    process.exit(1);
  }
  const key = need('UNSPLASH_ACCESS_KEY');
  const pages = Number(a.pages ?? 3);
  const db = await getDb();
  let added = 0;
  let skipped = 0;
  for (let page = 1; page <= pages; page++) {
    const { results, total_pages } = await searchPhotos(a.query, page, key);
    for (const photo of results) {
      if (!suitable(photo)) {
        skipped++;
        continue;
      }
      await db.insert(catalogueItem).values(toCatalogueRow(photo, room)).onConflictDoNothing();
      added++;
    }
    if (page >= total_pages) break;
  }
  console.log(`Added ${added} draft photos, skipped ${skipped} (wrong shape or too small).`);
});
