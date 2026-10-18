import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { eq } from 'drizzle-orm';
import { catalogueItem } from '@/db/schema';
import type { Db } from '@/db';
import {
  ATTRIBUTE_FAMILIES,
  CATEGORIES,
  ROOM_TYPES,
  STYLES,
  itemTagsSchema,
  type ItemTags,
} from '@/lib/taxonomy';

/** Flags that mean a card isn't fit to show: such items are retired rather than reviewed. */
export const BLOCKING_FLAGS = ['not_a_room', 'watermark', 'cluttered', 'poor_cutout'] as const;

const vocabulary = Object.entries(ATTRIBUTE_FAMILIES)
  .map(([family, values]) => `${family}: ${values.join(', ')}`)
  .join('\n');

/** The system prompt is identical for every item, so it caches across a whole batch. */
export const TAG_SYSTEM = `You label interior-design images for Hearth, an app that helps people agree on a room's style.

For each image (a whole-room photo or a single product) return:
- primary_style: the one best style from this list: ${STYLES.join(', ')}.
- style_weights: every style it plausibly fits, with a weight from 0 to 1 (the primary style is 1).
- attributes: only values from the lists below, written as family:value, for example material:brass or colour:sage. Include 3 to 10 that clearly apply. Also include any practical risks that apply (family practical).
${vocabulary}
- room_types: which of ${ROOM_TYPES.join(', ')} it suits.
- category: for a product, one of ${CATEGORIES.join(', ')}; null for a whole-room photo.
- dimensions_cm: width, depth and height in centimetres only if the product text states them; otherwise null.
- flags: any that apply: not_a_room (not interior design at all), watermark, cluttered (too busy to read), poor_cutout (a badly cut-out product image), low_quality, people_visible.
- summary: one plain sentence.

Be literal about what you can see. Do not guess sizes.`;

/** One request in a Message Batch (half price, asynchronous). */
export function tagRequest(item: {
  id: string;
  imageUrl: string;
  title: string;
  description: string | null;
}) {
  return {
    custom_id: item.id,
    params: {
      model: 'claude-opus-5-5' as const,
      max_tokens: 1500,
      thinking: { type: 'adaptive' as const },
      system: [
        { type: 'text' as const, text: TAG_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      ],
      messages: [
        {
          role: 'user' as const,
          content: [
            { type: 'image' as const, source: { type: 'url' as const, url: item.imageUrl } },
            {
              type: 'text' as const,
              text: `Title: ${item.title}\n${item.description ? `Description: ${item.description}` : ''}`,
            },
          ],
        },
      ],
      output_config: { effort: 'low' as const, format: zodOutputFormat(itemTagsSchema) },
    },
  };
}

/** Parses and validates the model's JSON. Null when it isn't usable (the item is tagged later). */
export function parseTagResponse(text: string): ItemTags | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = itemTagsSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Stores tags on an item. Items with a blocking flag are retired instead of going to review. */
export async function applyTags(
  db: Db,
  itemId: string,
  tags: ItemTags,
): Promise<'tagged' | 'retired'> {
  const blocked = tags.flags.some((f) => (BLOCKING_FLAGS as readonly string[]).includes(f));
  const [current] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, itemId));
  const dims = tags.dimensions_cm;
  const weights = Object.fromEntries(
    tags.style_weights.map((w) => [w.style, Math.min(1, Math.max(0, w.weight))]),
  );
  weights[tags.primary_style] = 1;
  await db
    .update(catalogueItem)
    .set({
      tags,
      attributes: tags.attributes,
      primaryStyle: tags.primary_style,
      styleWeights: weights,
      roomTypes: tags.room_types,
      category: current?.tier === 'micro' ? (tags.category ?? current.category) : null,
      // Stated sizes only fill gaps: a parsed feed value is better than a model's reading.
      widthCm: current?.widthCm ?? dims?.width ?? null,
      depthCm: current?.depthCm ?? dims?.depth ?? null,
      heightCm: current?.heightCm ?? dims?.height ?? null,
      taggedAt: new Date(),
      ...(blocked ? { status: 'retired' as const } : {}),
    })
    .where(eq(catalogueItem.id, itemId));
  return blocked ? 'retired' : 'tagged';
}
