import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  vector,
  boolean,
} from 'drizzle-orm/pg-core';
import { EMBEDDING_DIM, type ItemTags } from '@/lib/taxonomy';

export const retailer = pgTable('retailer', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  network: text('network', { enum: ['awin', 'skimlinks', 'manual'] })
    .notNull()
    .default('manual'),
  commissionNote: text('commission_note'),
  cookieDays: integer('cookie_days'),
});

export const catalogueItem = pgTable(
  'catalogue_item',
  {
    id: text('id').primaryKey(),
    tier: text('tier', { enum: ['macro', 'micro'] }).notNull(),
    roomTypes: text('room_types').array().notNull(),
    category: text('category'),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url').notNull(),
    imageW: integer('image_w'),
    imageH: integer('image_h'),
    extraImages: text('extra_images').array().notNull().default([]),
    source: text('source', { enum: ['unsplash', 'pexels', 'awin', 'manual', 'seed'] }).notNull(),
    sourceId: text('source_id').notNull(),
    attributionName: text('attribution_name'),
    attributionUrl: text('attribution_url'),
    unsplashDownloadLocation: text('unsplash_download_location'),
    retailerId: text('retailer_id').references(() => retailer.id),
    pricePence: integer('price_pence'),
    currency: text('currency').notNull().default('GBP'),
    productUrl: text('product_url'),
    affiliateUrl: text('affiliate_url'),
    inStock: boolean('in_stock').notNull().default(true),
    widthCm: real('width_cm'),
    depthCm: real('depth_cm'),
    heightCm: real('height_cm'),
    imageFailures: integer('image_failures').notNull().default(0),
    imageCheckedAt: timestamp('image_checked_at', { withTimezone: true }),
    status: text('status', { enum: ['draft', 'live', 'retired'] })
      .notNull()
      .default('draft'),
    /** Attributes as `family:value` strings (see taxonomy.ts). */
    attributes: text('attributes').array().notNull().default([]),
    tags: jsonb('tags').$type<ItemTags>(),
    primaryStyle: text('primary_style'),
    styleWeights: jsonb('style_weights').$type<Record<string, number>>(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIM }),
    taggedAt: timestamp('tagged_at', { withTimezone: true }),
    embeddedAt: timestamp('embedded_at', { withTimezone: true }),
    lastSeenInFeedAt: timestamp('last_seen_in_feed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('catalogue_item_source_unique').on(t.source, t.sourceId),
    index('catalogue_item_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('catalogue_item_status_idx').on(t.status, t.tier),
  ],
);

export const style = pgTable('style', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  centroid: vector('centroid', { dimensions: EMBEDDING_DIM }),
  itemCount: integer('item_count').notNull().default(0),
});

export const itemStats = pgTable('item_stats', {
  itemId: text('item_id')
    .primaryKey()
    .references(() => catalogueItem.id, { onDelete: 'cascade' }),
  exposures: integer('exposures').notNull().default(0),
  rights: integer('rights').notNull().default(0),
  tiebreakShown: integer('tiebreak_shown').notNull().default(0),
  tiebreakMutualYes: integer('tiebreak_mutual_yes').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  bought: integer('bought').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
