import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'wishlist',
  name: 'Wishlist',
  tagline: 'Gift ideas, with secret claims',
  description:
    'Add things you would love. Friends can claim a gift so nobody doubles up, and you never see who has claimed what.',
  icon: 'gift',
  category: 'practical',
  version: 1,
  nav: { label: 'Wishlist', order: 13 },
  collections: {
    wish: {
      fields: {
        title: { type: 'text', max: 120, required: true },
        link: { type: 'url' },
        price: { type: 'text', max: 20 },
        note: { type: 'longtext', max: 500 },
      },
      permissions: { update: 'author' },
    },
    claim: {
      parent: 'wish',
      unique: 'per-parent',
      fields: {},
      permissions: { hiddenFrom: 'parent-author', update: 'author', delete: 'author' },
    },
  },
} as const);
