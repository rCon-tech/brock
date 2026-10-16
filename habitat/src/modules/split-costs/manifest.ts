import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'split-costs',
  name: 'Split Costs',
  tagline: 'Who paid what, and who owes whom',
  description:
    'Log shared expenses on a trip or in a house. See everyone’s balance and the fewest payments needed to settle up.',
  icon: 'wallet',
  category: 'practical',
  version: 1,
  nav: { label: 'Costs', order: 14 },
  collections: {
    expense: {
      fields: {
        description: { type: 'text', max: 100, required: true },
        amount: { type: 'money', required: true },
        paidBy: { type: 'member', required: true },
        splitAmong: { type: 'member-list', min: 1, max: 150 },
      },
      permissions: { update: 'author-or-admin' },
    },
    settlement: {
      fields: {
        from: { type: 'member', required: true },
        to: { type: 'member', required: true },
        amount: { type: 'money', required: true },
      },
      permissions: { update: 'admin' },
    },
  },
} as const);
