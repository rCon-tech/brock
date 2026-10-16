import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'polls',
  name: 'Polls',
  tagline: 'Settle it with a vote',
  description: 'Ask the group a question. Single or multiple choice, with an optional closing time.',
  icon: 'bar-chart-3',
  category: 'fun',
  version: 1,
  nav: { label: 'Polls', order: 10 },
  collections: {
    poll: {
      fields: {
        question: { type: 'text', max: 200, required: true },
        options: { type: 'text-list', minItems: 2, maxItems: 10, maxLength: 100 },
        multiple: { type: 'boolean' },
        closesAt: { type: 'datetime' },
      },
      showInTimeline: true,
      permissions: { update: 'admin' },
    },
    vote: {
      parent: 'poll',
      lockedAfterParentField: 'closesAt',
      unique: 'per-member-per-parent',
      fields: { choices: { type: 'text-list', minItems: 1, maxItems: 10, maxLength: 100 } },
      realtime: true,
    },
  },
} as const);
