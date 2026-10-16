import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'photos',
  name: 'Photos',
  tagline: 'Shared albums anyone can add to',
  description:
    'Albums for trips, nights out and everything else. Every member can add photos. Photos are private to your Habitat and stripped of location data.',
  icon: 'images',
  category: 'social',
  version: 1,
  isDefault: true,
  nav: { label: 'Photos', order: 1 },
  collections: {
    album: {
      fields: {
        title: { type: 'text', max: 80, required: true },
        description: { type: 'longtext', max: 500 },
        coverMediaId: { type: 'media' },
      },
      showInTimeline: true,
      permissions: { update: 'author-or-admin' },
    },
    photo: {
      parent: 'album',
      fields: {
        mediaId: { type: 'media', required: true },
        caption: { type: 'text', max: 200 },
      },
    },
  },
} as const);
