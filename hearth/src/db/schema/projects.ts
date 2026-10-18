import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { catalogueItem } from './catalogue';
import type { ProjectContext } from '@/lib/context';

export const project = pgTable('project', {
  id: text('id').primaryKey(),
  roomType: text('room_type').notNull(),
  name: text('name'),
  budgetBand: text('budget_band', { enum: ['low', 'mid', 'high'] }),
  context: jsonb('context').$type<ProjectContext>().notNull(),
  mode: text('mode', { enum: ['remote', 'together_devices', 'together_one_device'] })
    .notNull()
    .default('remote'),
  isQuiz: boolean('is_quiz').notNull().default(false),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  previousProjectId: text('previous_project_id'),
  refPartner: text('ref_partner'),
  macroDeck: text('macro_deck').array().notNull(),
  microDeck: text('micro_deck').array().notNull(),
  reserveMacro: text('reserve_macro').array().notNull().default([]),
  reserveMicro: text('reserve_micro').array().notNull().default([]),
  deckSeed: text('deck_seed').notNull(),
  revealedAt: timestamp('revealed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectInvite = pgTable('project_invite', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  /** The token encrypted at rest, so the creator can see the same link again. */
  tokenEnc: text('token_enc'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const participant = pgTable(
  'participant',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    /** The user this participant is (null for people sharing a phone until they sign in). */
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    /** The session user that controls this participant. Equal to userId for normal participants. */
    hostUserId: text('host_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: ['creator', 'partner'] }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    macroDoneAt: timestamp('macro_done_at', { withTimezone: true }),
    microDoneAt: timestamp('micro_done_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    joinedAfterReveal: boolean('joined_after_reveal').notNull().default(false),
    lastRemindedAt: timestamp('last_reminded_at', { withTimezone: true }),
    vetoesLeft: smallint('vetoes_left').notNull().default(3),
    email: text('email'),
  },
  (t) => [
    uniqueIndex('participant_project_user_unique').on(t.projectId, t.userId),
    index('participant_host_idx').on(t.hostUserId),
  ],
);

export const swipe = pgTable(
  'swipe',
  {
    participantId: text('participant_id')
      .notNull()
      .references(() => participant.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => catalogueItem.id),
    round: text('round', { enum: ['macro', 'micro', 'bridge'] }).notNull(),
    value: smallint('value').notNull(),
    clientId: text('client_id').notNull(),
    decisionMs: integer('decision_ms'),
    position: integer('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.participantId, t.itemId, t.round] }),
    uniqueIndex('swipe_client_id_unique').on(t.clientId),
  ],
);

export const veto = pgTable('veto', {
  id: text('id').primaryKey(),
  participantId: text('participant_id')
    .notNull()
    .references(() => participant.id, { onDelete: 'cascade' }),
  itemId: text('item_id')
    .notNull()
    .references(() => catalogueItem.id),
  attribute: text('attribute'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bridgeRound = pgTable('bridge_round', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  synthesisVersion: integer('synthesis_version').notNull(),
  itemIds: text('item_ids').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimit = pgTable('rate_limit', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
});
