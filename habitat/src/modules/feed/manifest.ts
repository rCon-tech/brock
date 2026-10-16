import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'feed',
  name: 'Feed',
  tagline: 'Posts and photos for the whole group',
  description:
    'Share what is going on: text, up to 10 photos and @mentions. Newest first, no algorithm, no ads. Admins can pin a post to the top.',
  icon: 'newspaper',
  category: 'social',
  version: 1,
  isDefault: true,
  nav: false, // the Feed is the Habitat's home page
  collections: {
    post: {
      fields: {
        text: { type: 'longtext', max: 5000 },
        mediaIds: { type: 'media-list', max: 10 },
      },
      atLeastOne: ['text', 'mediaIds'],
      showInTimeline: true,
      permissions: { update: 'author', delete: 'author-or-admin' },
      notify: [{ on: 'create', to: 'mentioned', text: '{author} mentioned you in a post' }],
    },
  },
} as const);
