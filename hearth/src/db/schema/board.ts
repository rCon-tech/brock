import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { catalogueItem } from './catalogue';
import { participant, project } from './projects';
import type { SynthesisResult } from '@/lib/engine/types';

export const synthesis = pgTable(
  'synthesis',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    inputsHash: text('inputs_hash').notNull(),
    status: text('status', { enum: ['computing', 'ready'] }).notNull(),
    result: jsonb('result').$type<SynthesisResult>().notNull(),
    bridgeName: text('bridge_name'),
    tagline: text('tagline'),
    rationale: text('rationale'),
    contributions: jsonb('contributions').$type<{ participantId: string; brings: string }[]>(),
    aiModel: text('ai_model'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.version] })],
);

export const boardFeedback = pgTable(
  'board_feedback',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    helpful: boolean('helpful').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.participantId] })],
);

export const itemReaction = pgTable(
  'item_reaction',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => catalogueItem.id),
    participantId: text('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    reaction: text('reaction', { enum: ['love', 'unsure', 'no'] }).notNull(),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.itemId, t.participantId] })],
);

export const pickSwap = pgTable('pick_swap', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  synthesisVersion: integer('synthesis_version').notNull(),
  category: text('category').notNull(),
  fromItemId: text('from_item_id')
    .notNull()
    .references(() => catalogueItem.id),
  toItemId: text('to_item_id').references(() => catalogueItem.id),
  byParticipantId: text('by_participant_id')
    .notNull()
    .references(() => participant.id, { onDelete: 'cascade' }),
  undoneAt: timestamp('undone_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItem = pgTable(
  'shopping_list_item',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => catalogueItem.id),
    source: text('source', { enum: ['agreed', 'tiebreak', 'loved', 'saved'] }).notNull(),
    boughtAt: timestamp('bought_at', { withTimezone: true }),
    boughtByParticipantId: text('bought_by_participant_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.itemId] })],
);

export const outboundClick = pgTable('outbound_click', {
  id: text('id').primaryKey(),
  itemId: text('item_id')
    .notNull()
    .references(() => catalogueItem.id),
  projectId: text('project_id'),
  participantId: text('participant_id'),
  surface: text('surface', { enum: ['board', 'share', 'email', 'seo', 'brief'] })
    .notNull()
    .default('board'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const waitlist = pgTable('waitlist', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  feature: text('feature', { enum: ['see_in_room', 'designers'] }).notNull(),
  projectId: text('project_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
