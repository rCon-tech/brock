import { z } from 'zod';

/** Dimension of the stored embeddings. Keep in one place so the model can be swapped. */
export const EMBEDDING_DIM = 1024;

export const ROOM_TYPES = ['living_room', 'bedroom', 'dining_room'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_LABELS: Record<RoomType, string> = {
  living_room: 'Living room',
  bedroom: 'Bedroom',
  dining_room: 'Dining room',
};

export const STYLES = [
  'industrial',
  'minimalist',
  'japandi',
  'scandinavian',
  'mid_century',
  'modern_farmhouse',
  'coastal',
  'boho',
  'traditional',
  'art_deco',
  'maximalist',
  'rustic',
  'contemporary',
  'mediterranean',
  'wabi_sabi',
  'hollywood_regency',
  'french_country',
  'transitional',
  'organic_modern',
  'eclectic',
  'cottagecore',
  'warm_minimal',
  'brutalist',
  'shaker',
  'retro_70s',
] as const;
export type StyleSlug = (typeof STYLES)[number];

export function styleLabel(slug: string): string {
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const ATTRIBUTE_FAMILIES = {
  material: [
    'oak',
    'walnut',
    'dark_wood',
    'light_wood',
    'rattan',
    'cane',
    'marble',
    'travertine',
    'concrete',
    'linen',
    'boucle',
    'velvet',
    'leather',
    'wool',
    'jute',
    'metal_black',
    'brass',
    'chrome',
    'glass',
    'ceramic',
  ],
  colour: [
    'white',
    'cream',
    'beige',
    'greige',
    'grey',
    'charcoal',
    'black',
    'sage',
    'olive',
    'terracotta',
    'rust',
    'navy',
    'blush',
    'mustard',
    'multicolour',
  ],
  line: [
    'clean_lines',
    'curved',
    'chunky',
    'slim_legs',
    'tufted',
    'rounded_edges',
    'geometric',
    'ornate',
  ],
  finish: ['matte', 'gloss', 'distressed', 'natural', 'lacquered'],
  mood: ['airy', 'cosy', 'dramatic', 'calm', 'playful', 'earthy'],
  practical: [
    'delicate',
    'light_fabric',
    'loop_pile',
    'glass_top',
    'sharp_corners',
    'high_maintenance',
  ],
} as const;
export type AttributeFamily = keyof typeof ATTRIBUTE_FAMILIES;

/** Attributes are always written `family:value`, e.g. `material:brass`. */
export type Attribute = string;
export const ATTRIBUTES: readonly Attribute[] = Object.entries(ATTRIBUTE_FAMILIES).flatMap(
  ([family, values]) => values.map((v) => `${family}:${v}`),
);
const ATTRIBUTE_SET = new Set<string>(ATTRIBUTES);
export const attributeSchema = z.string().refine((a) => ATTRIBUTE_SET.has(a), 'Unknown attribute');

export function attributeLabel(attr: string): string {
  const value = attr.includes(':') ? attr.split(':')[1] : attr;
  return value.replace(/_/g, ' ');
}
export function attributeFamily(attr: string): AttributeFamily {
  return attr.split(':')[0] as AttributeFamily;
}

export const CATEGORIES = [
  'sofa',
  'armchair',
  'coffee_table',
  'rug',
  'ceiling_light',
  'floor_lamp',
  'table_lamp',
  'storage',
  'side_table',
  'decor',
  'bed',
  'bedside_table',
  'wardrobe',
  'dining_table',
  'dining_chair',
  'sideboard',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  sofa: 'Sofa',
  armchair: 'Armchair',
  coffee_table: 'Coffee table',
  rug: 'Rug',
  ceiling_light: 'Ceiling light',
  floor_lamp: 'Floor lamp',
  table_lamp: 'Table lamp',
  storage: 'Storage',
  side_table: 'Side table',
  decor: 'Decor',
  bed: 'Bed',
  bedside_table: 'Bedside table',
  wardrobe: 'Wardrobe',
  dining_table: 'Dining table',
  dining_chair: 'Dining chair',
  sideboard: 'Sideboard',
};

export const BUDGET_BANDS = ['low', 'mid', 'high'] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];
export const BUDGET_LABELS: Record<BudgetBand, string> = { low: '£', mid: '££', high: '£££' };

/** Rooms the practical-risk attributes apply to (R15). */
export const PRACTICAL_ATTRIBUTES = ATTRIBUTE_FAMILIES.practical.map((p) => `practical:${p}`);

export const ITEM_STATUSES = ['draft', 'live', 'retired'] as const;

/** What the tagging step produces for each catalogue item (§10.2). */
export const itemTagsSchema = z.object({
  primary_style: z.enum(STYLES),
  style_weights: z.record(z.enum(STYLES), z.number().min(0).max(1)),
  attributes: z.array(attributeSchema),
  room_types: z.array(z.enum(ROOM_TYPES)).min(1),
  category: z.enum(CATEGORIES).nullable(),
  dimensions_cm: z
    .object({
      width: z.number().positive().nullable(),
      depth: z.number().positive().nullable(),
      height: z.number().positive().nullable(),
    })
    .nullable(),
  flags: z.array(
    z.enum([
      'not_a_room',
      'watermark',
      'cluttered',
      'poor_cutout',
      'low_quality',
      'people_visible',
    ]),
  ),
  summary: z.string().max(200),
});
export type ItemTags = z.infer<typeof itemTagsSchema>;

/** Approximate swatch colours for the palette on the board and the style brief. */
export const COLOUR_HEX: Record<string, string> = {
  'colour:white': '#f7f5f0',
  'colour:cream': '#efe6d2',
  'colour:beige': '#d8c7a8',
  'colour:greige': '#bdb2a2',
  'colour:grey': '#9a9a9a',
  'colour:charcoal': '#3f4246',
  'colour:black': '#1b1b1d',
  'colour:sage': '#9db08f',
  'colour:olive': '#7a7a3e',
  'colour:terracotta': '#c36d4b',
  'colour:rust': '#a4482a',
  'colour:navy': '#24365c',
  'colour:blush': '#e7bfb5',
  'colour:mustard': '#d1a02c',
  'colour:multicolour': '#b077c8',
};
