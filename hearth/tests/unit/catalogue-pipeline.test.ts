import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mapCategory, roomsFor } from '@/lib/catalogue/category-map';
import { parseDimensions, parseFeed, parseInStock, parsePricePence } from '@/lib/catalogue/feeds';
import {
  searchPhotos,
  suitable,
  toCatalogueRow,
  trackDownload,
  type UnsplashPhoto,
} from '@/lib/unsplash';

describe('feed parsing', () => {
  it('reads prices in pence from messy retailer formats', () => {
    expect(parsePricePence('£899.00')).toBe(89900);
    expect(parsePricePence('£1 249.50'.replace(' ', ','))).toBe(124950);
    expect(parsePricePence('89.99')).toBe(8999);
    expect(parsePricePence('1,299.00')).toBe(129900);
    expect(parsePricePence('£0.00')).toBeNull();
    expect(parsePricePence('free')).toBeNull();
  });

  it('reads stock flags', () => {
    expect(['1', 'yes', 'in stock', 'In_Stock', 'true', ''].map(parseInStock)).toEqual(
      Array(6).fill(true),
    );
    expect(['0', 'no', 'out of stock', 'false'].map(parseInStock)).toEqual(Array(4).fill(false));
  });

  it('finds sizes in centimetres, millimetres and labelled forms, and never guesses', () => {
    expect(parseDimensions('A sofa. W210 x D95 x H85 cm')).toEqual({
      widthCm: 210,
      depthCm: 95,
      heightCm: 85,
    });
    expect(parseDimensions('110 x 60 x 42cm')).toEqual({ widthCm: 110, depthCm: 60, heightCm: 42 });
    expect(parseDimensions('1800 x 400 x 400 mm')).toEqual({
      widthCm: 180,
      depthCm: 40,
      heightCm: 40,
    });
    expect(parseDimensions('Adjustable arc, 1800mm tall, 45 cm wide')).toEqual({
      widthCm: 45,
      depthCm: null,
      heightCm: 180,
    });
    expect(parseDimensions('Natural jute weave')).toEqual({
      widthCm: null,
      depthCm: null,
      heightCm: null,
    });
  });

  it('maps retailer categories to ours, most specific first', () => {
    expect(mapCategory('Bedroom', 'Walnut Bedside Table')).toBe('bedside_table');
    expect(mapCategory('Furniture > Sofas', 'Oslo 3 Seater Sofa')).toBe('sofa');
    expect(mapCategory('Dining', 'Dining Chair Set of Two')).toBe('dining_chair');
    expect(mapCategory('Lighting', 'Brass Arc Floor Lamp')).toBe('floor_lamp');
    expect(mapCategory('Gifts > Misc', 'Mystery Item')).toBeNull();
    expect(roomsFor('sofa')).toEqual(['living_room']);
    expect(roomsFor('rug').sort()).toEqual(['bedroom', 'dining_room', 'living_room']);
  });

  const feed = parseFeed(readFileSync('tests/fixtures/awin-feed.csv', 'utf8'));

  it('keeps good products with their sizes and links', () => {
    const sofa = feed.items.find((i) => i.sourceId === '1001')!;
    expect(sofa).toMatchObject({
      category: 'sofa',
      pricePence: 89900,
      affiliateUrl: 'https://track.example/1001',
      productUrl: 'https://shop.example/oslo-sofa',
      inStock: true,
      widthCm: 210,
      depthCm: 95,
      heightCm: 85,
      extraImages: ['https://img.example/oslo-2.jpg'],
      roomTypes: ['living_room'],
    });
    expect(feed.items.find((i) => i.sourceId === '1003')).toMatchObject({
      inStock: false,
      category: 'floor_lamp',
      heightCm: 180,
    });
  });

  it('skips bad rows and says why', () => {
    expect(feed.items.map((i) => i.sourceId).sort()).toEqual([
      '1001',
      '1002',
      '1003',
      '1004',
      '1006',
      '1010',
    ]);
    expect(feed.skipped).toEqual({
      missing_field: 1,
      bad_price: 1,
      unmapped_category: 1,
      bad_url: 1,
    });
  });
});

describe('Unsplash', () => {
  const photo = (over: Partial<UnsplashPhoto> = {}): UnsplashPhoto => ({
    id: 'abc',
    width: 2400,
    height: 3000,
    alt_description: 'a cosy living room with a grey sofa',
    description: null,
    urls: { regular: 'https://images.unsplash.com/photo-abc?w=1080' },
    user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@jane' } },
    links: {
      html: 'https://unsplash.com/photos/abc',
      download_location: 'https://api.unsplash.com/photos/abc/download',
    },
    ...over,
  });

  it('keeps big portrait photos and drops the rest', () => {
    expect(suitable(photo())).toBe(true);
    expect(suitable(photo({ width: 3000, height: 2000 }))).toBe(false); // landscape
    expect(suitable(photo({ width: 800, height: 1000 }))).toBe(false); // too small
    expect(suitable(photo({ width: 1000, height: 2400 }))).toBe(false); // too tall
  });

  it('credits the photographer and keeps the download-tracking link', () => {
    const row = toCatalogueRow(photo(), 'living_room');
    expect(row).toMatchObject({
      id: 'unsplash-abc',
      tier: 'macro',
      source: 'unsplash',
      attributionName: 'Jane Doe',
      unsplashDownloadLocation: 'https://api.unsplash.com/photos/abc/download',
      title: 'A Cosy Living Room With A Grey Sofa',
    });
    expect(row.attributionUrl).toContain('utm_source=hearth');
    expect(row.imageUrl).toContain('images.unsplash.com');
  });

  it('searches with the access key and validates the response', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ total_pages: 2, results: [photo()] }), { status: 200 }),
    );
    const out = await searchPhotos('living room', 1, 'KEY', fetcher as unknown as typeof fetch);
    expect(out.results).toHaveLength(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get('orientation')).toBe('portrait');
    expect((init.headers as Record<string, string>).Authorization).toBe('Client-ID KEY');
    await expect(
      searchPhotos(
        'x',
        1,
        'k',
        (async () => new Response('no', { status: 403 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/403/);
    await expect(
      searchPhotos(
        'x',
        1,
        'k',
        (async () =>
          new Response('{"results":[{"id":1}]}', { status: 200 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow();
  });

  it('pings the download location when a photo is used', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    await trackDownload(
      'https://api.unsplash.com/photos/abc/download',
      'KEY',
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledWith('https://api.unsplash.com/photos/abc/download', {
      headers: { Authorization: 'Client-ID KEY' },
    });
  });
});
