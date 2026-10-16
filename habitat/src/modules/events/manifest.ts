import { defineManifest } from '../sdk/define';

export const manifest = defineManifest({
  id: 'events',
  name: 'Events',
  tagline: 'Plans with RSVPs and reminders',
  description:
    'Put a plan on the calendar. Everyone answers going, maybe or no. Get a reminder the day before, and add it to your own calendar.',
  icon: 'calendar-days',
  category: 'plans',
  version: 1,
  isDefault: true,
  nav: { label: 'Events', order: 2 },
  collections: {
    event: {
      fields: {
        title: { type: 'text', max: 100, required: true },
        startsAt: { type: 'datetime', required: true },
        endsAt: { type: 'datetime' },
        location: { type: 'text', max: 200 },
        details: { type: 'longtext', max: 2000 },
        coverMediaId: { type: 'media' },
      },
      showInTimeline: true,
      permissions: { update: 'author-or-admin' },
      notify: [{ on: 'create', to: 'all-members', text: '{author} planned “{title}”' }],
    },
    rsvp: {
      parent: 'event',
      unique: 'per-member-per-parent',
      fields: { status: { type: 'enum', options: ['going', 'maybe', 'no'], required: true } },
      notify: [
        { on: 'create', to: 'parent-author', text: '{author} replied “{status}” to your event' },
      ],
    },
  },
} as const);
