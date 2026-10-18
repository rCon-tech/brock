/**
 * Hand-written table of which colours and materials sit well beside a kept item (R14).
 * Keys and values are `family:value` attributes.
 */
const NEUTRALS = ['colour:white', 'colour:cream', 'colour:beige', 'colour:greige'];

export const HARMONY: Record<string, string[]> = {
  'colour:grey': [
    ...NEUTRALS,
    'colour:charcoal',
    'colour:black',
    'colour:sage',
    'colour:navy',
    'colour:blush',
    'material:light_wood',
    'material:oak',
    'material:brass',
  ],
  'colour:charcoal': [
    ...NEUTRALS,
    'colour:grey',
    'colour:mustard',
    'colour:terracotta',
    'material:brass',
    'material:oak',
  ],
  'colour:beige': [
    ...NEUTRALS,
    'colour:sage',
    'colour:terracotta',
    'colour:olive',
    'material:oak',
    'material:jute',
    'material:rattan',
  ],
  'colour:cream': [
    ...NEUTRALS,
    'colour:sage',
    'colour:blush',
    'colour:terracotta',
    'material:oak',
    'material:boucle',
  ],
  'colour:white': [
    ...NEUTRALS,
    'colour:grey',
    'colour:navy',
    'colour:sage',
    'material:light_wood',
    'material:oak',
  ],
  'colour:black': [
    ...NEUTRALS,
    'colour:grey',
    'colour:mustard',
    'material:brass',
    'material:walnut',
  ],
  'colour:navy': [
    ...NEUTRALS,
    'colour:grey',
    'colour:mustard',
    'colour:blush',
    'material:brass',
    'material:oak',
  ],
  'colour:sage': [
    ...NEUTRALS,
    'colour:grey',
    'colour:terracotta',
    'material:oak',
    'material:rattan',
    'material:brass',
  ],
  'colour:terracotta': [
    ...NEUTRALS,
    'colour:sage',
    'colour:olive',
    'colour:navy',
    'material:oak',
    'material:jute',
  ],
  'colour:rust': [
    'colour:cream',
    'colour:olive',
    'colour:navy',
    'material:walnut',
    'material:leather',
  ],
  'colour:mustard': [
    'colour:grey',
    'colour:charcoal',
    'colour:navy',
    'colour:cream',
    'material:walnut',
  ],
  'colour:blush': [...NEUTRALS, 'colour:grey', 'colour:sage', 'colour:navy', 'material:brass'],
  'colour:olive': [
    ...NEUTRALS,
    'colour:terracotta',
    'colour:rust',
    'material:oak',
    'material:leather',
  ],
  'material:oak': [
    ...NEUTRALS,
    'material:linen',
    'material:wool',
    'material:jute',
    'material:brass',
    'colour:sage',
  ],
  'material:walnut': [
    ...NEUTRALS,
    'material:leather',
    'material:brass',
    'material:wool',
    'colour:mustard',
  ],
  'material:dark_wood': [...NEUTRALS, 'material:leather', 'material:brass', 'material:velvet'],
  'material:light_wood': [...NEUTRALS, 'material:linen', 'material:wool', 'colour:sage'],
  'material:leather': [
    'material:walnut',
    'material:oak',
    'material:brass',
    'colour:cream',
    'colour:olive',
  ],
};

/** 1 if the item carries at least one attribute that sits well with the anchor, else 0. */
export function harmonyScore(anchor: string, itemAttributes: readonly string[]): number {
  const friends = HARMONY[anchor];
  if (!friends) return 0;
  return itemAttributes.some((a) => friends.includes(a)) ? 1 : 0;
}
