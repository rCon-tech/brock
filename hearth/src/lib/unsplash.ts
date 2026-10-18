import { z } from 'zod';
import type { RoomType } from '@/lib/taxonomy';

const photoSchema = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  alt_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  urls: z.object({ regular: z.string().url() }),
  user: z.object({ name: z.string(), links: z.object({ html: z.string().url() }) }),
  links: z.object({ html: z.string().url(), download_location: z.string().url() }),
});
export type UnsplashPhoto = z.infer<typeof photoSchema>;

export const searchResponseSchema = z.object({
  total_pages: z.number(),
  results: z.array(photoSchema),
});

/** Portrait photos suit phones. Keep roughly 4:5 to 3:4 and big enough to look sharp. */
const MIN_LONG_EDGE = 1600;
const MIN_RATIO = 1.2;
const MAX_RATIO = 1.45;

export function suitable(photo: Pick<UnsplashPhoto, 'width' | 'height'>): boolean {
  const ratio = photo.height / photo.width;
  return (
    Math.max(photo.width, photo.height) >= MIN_LONG_EDGE && ratio >= MIN_RATIO && ratio <= MAX_RATIO
  );
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A draft catalogue row from a photo. Unsplash's terms require hotlinking their URLs, crediting the
 * photographer, and pinging `download_location` when a photo is used (see `trackDownload`).
 */
export function toCatalogueRow(photo: UnsplashPhoto, room: RoomType) {
  const roomLabel = room.replace('_', ' ');
  const alt = photo.alt_description?.trim();
  return {
    id: `unsplash-${photo.id}`,
    tier: 'macro' as const,
    roomTypes: [room],
    title: alt ? titleCase(alt).slice(0, 80) : `${titleCase(roomLabel)} inspiration`,
    description: photo.description ?? null,
    imageUrl: photo.urls.regular,
    imageW: photo.width,
    imageH: photo.height,
    source: 'unsplash' as const,
    sourceId: photo.id,
    attributionName: photo.user.name,
    attributionUrl: `${photo.user.links.html}?utm_source=hearth&utm_medium=referral`,
    unsplashDownloadLocation: photo.links.download_location,
  };
}

export async function searchPhotos(
  query: string,
  page: number,
  accessKey: string,
  fetcher: typeof fetch = fetch,
): Promise<z.infer<typeof searchResponseSchema>> {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.search = new URLSearchParams({
    query,
    page: String(page),
    per_page: '30',
    orientation: 'portrait',
  }).toString();
  const res = await fetcher(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`);
  return searchResponseSchema.parse(await res.json());
}

/** Required by Unsplash's API terms whenever a photo is actually used. */
export async function trackDownload(
  downloadLocation: string,
  accessKey: string,
  fetcher: typeof fetch = fetch,
) {
  await fetcher(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } });
}
