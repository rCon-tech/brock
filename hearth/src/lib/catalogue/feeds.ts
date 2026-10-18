import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { Category, RoomType } from '@/lib/taxonomy';
import { mapCategory, roomsFor } from './category-map';

export interface FeedItem {
  sourceId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  extraImages: string[];
  pricePence: number;
  currency: string;
  affiliateUrl: string;
  productUrl: string | null;
  inStock: boolean;
  category: Category;
  roomTypes: RoomType[];
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
}

export type SkipReason = 'missing_field' | 'bad_price' | 'unmapped_category' | 'bad_url';

export interface FeedResult {
  items: FeedItem[];
  skipped: Record<SkipReason, number>;
}

/** Awin feeds differ by merchant, so each field is read from the first column that has it. */
const COLUMNS = {
  id: ['aw_product_id', 'merchant_product_id', 'product_id', 'id'],
  title: ['product_name', 'title', 'name'],
  description: ['description', 'product_short_description', 'merchant_description'],
  price: ['search_price', 'store_price', 'base_price', 'price'],
  currency: ['currency', 'currency_code'],
  link: ['aw_deep_link', 'affiliate_link', 'deep_link'],
  merchantLink: ['merchant_deep_link', 'product_url', 'link'],
  image: ['merchant_image_url', 'aw_image_url', 'image_url', 'large_image'],
  extraImages: [
    'alternate_image',
    'alternate_image_two',
    'alternate_image_three',
    'alternate_image_four',
  ],
  category: ['merchant_category', 'category_name', 'product_type', 'category'],
  stock: ['in_stock', 'stock_status', 'availability'],
} as const;

type Row = Record<string, string>;

function pick(row: Row, names: readonly string[]): string {
  for (const n of names) {
    const v = row[n]?.trim();
    if (v) return v;
  }
  return '';
}

/** "£1,299.00" or "1299.00" to pence. Null for anything that isn't a positive price. */
export function parsePricePence(raw: string): number | null {
  const cleaned = raw
    .replace(/[^0-9.,]/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function parseInStock(raw: string): boolean {
  if (!raw) return true;
  return /^(1|y|yes|true|in[\s_-]?stock|available)$/i.test(raw.trim());
}

/**
 * Sizes from free text, in centimetres: "W120 x D45 x H80 cm", "120 x 45 x 80cm" (taken as
 * width, depth, height) or the same in mm. Unknown stays null: "check the size" beats a guess.
 */
export function parseDimensions(text: string): {
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
} {
  const none = { widthCm: null, depthCm: null, heightCm: null };
  const mm = /\bmm\b/i.test(text) && !/\bcm\b/i.test(text);
  const scale = (n: number) => Math.round((mm ? n / 10 : n) * 10) / 10;

  const labelled = (letter: string) => {
    const m = new RegExp(`\\b${letter}\\s*[:=]?\\s*(\\d{1,4}(?:\\.\\d+)?)`, 'i').exec(text);
    return m ? scale(Number(m[1])) : null;
  };
  const w = labelled('W');
  const d = labelled('D');
  const h = labelled('H');
  if (w !== null || d !== null || h !== null) return { widthCm: w, depthCm: d, heightCm: h };

  const triple =
    /(\d{2,4}(?:\.\d+)?)\s*(?:cm|mm)?\s*[x×]\s*(\d{2,4}(?:\.\d+)?)\s*(?:cm|mm)?\s*[x×]\s*(\d{2,4}(?:\.\d+)?)\s*(cm|mm)/i.exec(
      text,
    );
  if (triple)
    return {
      widthCm: scale(Number(triple[1])),
      depthCm: scale(Number(triple[2])),
      heightCm: scale(Number(triple[3])),
    };
  const pair = /(\d{2,4}(?:\.\d+)?)\s*(?:cm|mm)?\s*[x×]\s*(\d{2,4}(?:\.\d+)?)\s*(cm|mm)/i.exec(
    text,
  );
  if (pair)
    return { widthCm: scale(Number(pair[1])), depthCm: scale(Number(pair[2])), heightCm: null };

  // "1800mm tall", "45cm wide", "30 cm deep": common in lamp and rug descriptions.
  const spoken = (words: string) => {
    const m = new RegExp(`(\\d{2,4}(?:\\.\\d+)?)\\s*(cm|mm)\\s*(?:${words})\\b`, 'i').exec(text);
    return m
      ? Math.round((m[2].toLowerCase() === 'mm' ? Number(m[1]) / 10 : Number(m[1])) * 10) / 10
      : null;
  };
  const spokenW = spoken('wide|width');
  const spokenD = spoken('deep|depth');
  const spokenH = spoken('tall|high|height');
  if (spokenW !== null || spokenD !== null || spokenH !== null) {
    return { widthCm: spokenW, depthCm: spokenD, heightCm: spokenH };
  }
  return none;
}

const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u));

/** Parses one merchant's CSV feed into candidate products, counting what it had to skip and why. */
export function parseFeed(csv: string): FeedResult {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Row[];
  const skipped: Record<SkipReason, number> = {
    missing_field: 0,
    bad_price: 0,
    unmapped_category: 0,
    bad_url: 0,
  };
  const items: FeedItem[] = [];

  for (const row of rows) {
    const id = pick(row, COLUMNS.id);
    const title = pick(row, COLUMNS.title);
    const image = pick(row, COLUMNS.image);
    const link = pick(row, COLUMNS.link) || pick(row, COLUMNS.merchantLink);
    if (!id || !title || !image || !link) {
      skipped.missing_field++;
      continue;
    }
    if (!httpUrl.safeParse(image).success || !httpUrl.safeParse(link).success) {
      skipped.bad_url++;
      continue;
    }
    const pricePence = parsePricePence(pick(row, COLUMNS.price));
    if (pricePence === null) {
      skipped.bad_price++;
      continue;
    }
    const category = mapCategory(pick(row, COLUMNS.category), title);
    if (!category) {
      skipped.unmapped_category++;
      continue;
    }
    const description = pick(row, COLUMNS.description) || null;
    const merchantLink = pick(row, COLUMNS.merchantLink);
    items.push({
      sourceId: id,
      title,
      description,
      imageUrl: image,
      extraImages: COLUMNS.extraImages
        .map((c) => row[c]?.trim())
        .filter((u): u is string => !!u && httpUrl.safeParse(u).success),
      pricePence,
      currency: pick(row, COLUMNS.currency) || 'GBP',
      affiliateUrl: link,
      productUrl: merchantLink && httpUrl.safeParse(merchantLink).success ? merchantLink : null,
      inStock: parseInStock(pick(row, COLUMNS.stock)),
      category,
      roomTypes: roomsFor(category),
      ...parseDimensions(`${title}. ${description ?? ''}`),
    });
  }
  return { items, skipped };
}
