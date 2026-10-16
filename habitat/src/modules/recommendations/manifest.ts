import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'recommendations',
  name: 'Recommendations',
  tagline: 'Books, films, places and more',
  description: 'Tell the group what to read, watch, play and visit, with a star rating.',
  icon: 'thumbs-up',
  category: 'fun',
  version: 1,
  nav: { label: 'Recs', order: 12 },
  collections: {
    rec: {
      fields: {
        kind: {
          type: 'enum',
          options: ['book', 'film', 'tv', 'music', 'place', 'game', 'other'],
          required: true,
        },
        title: { type: 'text', max: 120, required: true },
        link: { type: 'url' },
        note: { type: 'longtext', max: 500 },
        rating: { type: 'integer', min: 1, max: 5 },
      },
      showInTimeline: true,
      permissions: { update: 'author' },
    },
  },
} as const);
