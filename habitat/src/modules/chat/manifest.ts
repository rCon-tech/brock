import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'chat',
  name: 'Chat',
  tagline: 'One live group chat',
  description: 'A single chat for the whole Habitat, with photos and typing indicators.',
  icon: 'message-circle',
  category: 'social',
  version: 1,
  isDefault: true,
  nav: { label: 'Chat', order: 3 },
  collections: {
    message: {
      fields: {
        text: { type: 'longtext', max: 2000 },
        mediaIds: { type: 'media-list', max: 4 },
      },
      atLeastOne: ['text', 'mediaIds'],
      realtime: true,
      permissions: { update: 'author', delete: 'author-or-admin' },
    },
  },
} as const);
