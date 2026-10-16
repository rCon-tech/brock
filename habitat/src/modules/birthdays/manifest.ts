import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'birthdays',
  name: 'Birthdays',
  tagline: 'Never miss one again',
  description:
    'Everyone adds their own birthday. Get a reminder on the day and a countdown on the home page.',
  icon: 'cake',
  category: 'social',
  version: 1,
  nav: { label: 'Birthdays', order: 11 },
  collections: {
    birthday: {
      unique: 'per-member',
      fields: {
        month: { type: 'integer', min: 1, max: 12, required: true },
        day: { type: 'integer', min: 1, max: 31, required: true },
        year: { type: 'integer', min: 1900, max: 2100 },
      },
    },
  },
} as const);
