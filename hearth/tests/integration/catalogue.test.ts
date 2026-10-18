import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, type Db } from '@/db';
import { catalogueItem } from '@/db/schema';
import { applyTags } from '@/lib/ai/tag-item';
import { clearCatalogueCache, loadEngineItems } from '@/lib/catalogue/load';
import { parseFeed } from '@/lib/catalogue/feeds';
import { retireMissing, upsertFeedItems } from '@/lib/catalogue/upsert';
import type { ItemTags } from '@/lib/taxonomy';

let db: Db;
beforeAll(async () => {
  db = await getDb();
});

const merchant = { id: 'testshop', name: 'Test Shop' };
const feed = () => parseFeed(readFileSync('tests/fixtures/awin-feed.csv', 'utf8'));
const row = async (sourceId: string) =>
  (
    await db
      .select()
      .from(catalogueItem)
      .where(eq(catalogueItem.sourceId, `testshop:${sourceId}`))
  )[0];

describe('feed import', () => {
  it('adds products as drafts that are not shown to anyone yet', async () => {
    const out = await upsertFeedItems(db, merchant, feed().items);
    expect(out).toEqual({ created: 6, updated: 0 });
    expect((await row('1001')).status).toBe('draft');
    expect(await loadEngineItems(db, 'living_room')).toHaveLength(0);
  });

  it('refreshes price and stock on a re-import without touching status or tags', async () => {
    await db
      .update(catalogueItem)
      .set({ status: 'live' })
      .where(eq(catalogueItem.sourceId, 'testshop:1001'));
    const items = feed().items.map((i) =>
      i.sourceId === '1001' ? { ...i, pricePence: 79900, inStock: false } : i,
    );
    expect(await upsertFeedItems(db, merchant, items)).toEqual({ created: 0, updated: 6 });
    expect(await row('1001')).toMatchObject({ pricePence: 79900, inStock: false, status: 'live' });
  });

  it('retires products that have vanished from the feed for three nights', async () => {
    const all = feed().items.map((i) => i.sourceId);
    const day = 86_400_000;
    // Missing for one night: kept.
    await db
      .update(catalogueItem)
      .set({ lastSeenInFeedAt: new Date(Date.now() - day) })
      .where(eq(catalogueItem.sourceId, 'testshop:1002'));
    expect(
      await retireMissing(
        db,
        merchant.id,
        all.filter((id) => id !== '1002'),
      ),
    ).toBe(0);
    // Missing for four nights: retired.
    await db
      .update(catalogueItem)
      .set({ lastSeenInFeedAt: new Date(Date.now() - 4 * day) })
      .where(eq(catalogueItem.sourceId, 'testshop:1002'));
    expect(
      await retireMissing(
        db,
        merchant.id,
        all.filter((id) => id !== '1002'),
      ),
    ).toBe(1);
    expect((await row('1002')).status).toBe('retired');
    // Still listed: never retired, however old.
    await db
      .update(catalogueItem)
      .set({ lastSeenInFeedAt: new Date(Date.now() - 9 * day) })
      .where(eq(catalogueItem.sourceId, 'testshop:1004'));
    expect(await retireMissing(db, merchant.id, all)).toBe(0);
    expect((await row('1004')).status).not.toBe('retired');
  });
});

describe('applying tags', () => {
  const tags = (over: Partial<ItemTags> = {}): ItemTags => ({
    primary_style: 'japandi',
    style_weights: [
      { style: 'japandi', weight: 0.8 },
      { style: 'minimalist', weight: 0.5 },
    ],
    attributes: ['material:oak', 'colour:beige'],
    room_types: ['living_room'],
    category: 'rug',
    dimensions_cm: { width: 200, depth: 300, height: null },
    flags: [],
    summary: 'A rug.',
    ...over,
  });

  it('stores tags, forces the primary style to full weight, and fills only missing sizes', async () => {
    expect(
      await applyTags(
        db,
        (await row('1006')).id,
        tags({ category: 'bedside_table', room_types: ['bedroom'] }),
      ),
    ).toBe('tagged');
    expect(await row('1006')).toMatchObject({
      primaryStyle: 'japandi',
      styleWeights: { japandi: 1, minimalist: 0.5 },
      attributes: ['material:oak', 'colour:beige'],
      roomTypes: ['bedroom'],
      category: 'bedside_table',
      widthCm: 200, // the feed had no size, so the model's reading fills the gap
    });
    // A size already parsed from the feed is kept over the model's reading.
    await applyTags(
      db,
      (await row('1001')).id,
      tags({ category: 'sofa', dimensions_cm: { width: 1, depth: 1, height: 1 } }),
    );
    expect(await row('1001')).toMatchObject({ widthCm: 210, depthCm: 95, heightCm: 85 });
  });

  it.each(['not_a_room', 'watermark', 'cluttered', 'poor_cutout'] as const)(
    'retires an item flagged %s',
    async (flag) => {
      expect(await applyTags(db, (await row('1010')).id, tags({ flags: [flag] }))).toBe('retired');
      expect((await row('1010')).status).toBe('retired');
      await db
        .update(catalogueItem)
        .set({ status: 'draft' })
        .where(eq(catalogueItem.sourceId, 'testshop:1010'));
    },
  );

  it('keeps informational flags without retiring', async () => {
    expect(await applyTags(db, (await row('1010')).id, tags({ flags: ['low_quality'] }))).toBe(
      'tagged',
    );
    clearCatalogueCache();
  });
});
