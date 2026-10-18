import { eq } from 'drizzle-orm';
import { catalogueItem } from '@/db/schema';
import type { Db } from '@/db';
import { clearCatalogueCache } from '@/lib/catalogue/load';

/** Retire an item once its image has failed this many checks in a row (R33). */
export const MAX_IMAGE_FAILURES = 2;
const CONCURRENCY = 10;

export type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status'>>;

async function imageWorks(url: string, fetcher: Fetcher): Promise<boolean> {
  try {
    const head = await fetcher(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) return true;
    // Some hosts reject HEAD; ask for the first byte instead.
    if (head.status === 405 || head.status === 403) {
      const ranged = await fetcher(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      return ranged.ok;
    }
    return false;
  } catch {
    return false;
  }
}

/** Counts a failure reported by a browser or the nightly check; retires at the limit. */
export async function reportImageFailure(db: Db, itemId: string): Promise<void> {
  const [item] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, itemId));
  if (!item || item.status === 'retired') return;
  const failures = item.imageFailures + 1;
  await db
    .update(catalogueItem)
    .set({
      imageFailures: failures,
      imageCheckedAt: new Date(),
      ...(failures >= MAX_IMAGE_FAILURES ? { status: 'retired' as const } : {}),
    })
    .where(eq(catalogueItem.id, itemId));
  if (failures >= MAX_IMAGE_FAILURES) clearCatalogueCache();
}

/** Nightly: HEAD every live item's image; count failures, reset on success, retire repeat offenders. */
export async function checkImages(
  db: Db,
  fetcher: Fetcher = fetch,
  opts: { siteUrl?: string } = {},
): Promise<{ checked: number; failed: number; retired: number }> {
  const items = await db
    .select({
      id: catalogueItem.id,
      url: catalogueItem.imageUrl,
      failures: catalogueItem.imageFailures,
    })
    .from(catalogueItem)
    .where(eq(catalogueItem.status, 'live'));
  let failed = 0;
  const retire: string[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(
      items.slice(i, i + CONCURRENCY).map(async (item) => {
        // Seed images are served by this app, not a third party.
        const url = item.url.startsWith('/')
          ? `${opts.siteUrl ?? 'http://localhost:3000'}${item.url}`
          : item.url;
        const ok = await imageWorks(url, fetcher);
        if (ok) {
          if (item.failures > 0) {
            await db
              .update(catalogueItem)
              .set({ imageFailures: 0, imageCheckedAt: new Date() })
              .where(eq(catalogueItem.id, item.id));
          }
          return;
        }
        failed++;
        if (item.failures + 1 >= MAX_IMAGE_FAILURES) retire.push(item.id);
        await reportImageFailure(db, item.id);
      }),
    );
  }
  return { checked: items.length, failed, retired: retire.length };
}
