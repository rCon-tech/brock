import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts('created_at').notNull().defaultNow();

// ---------------------------------------------------------------------------
// Auth tables: the shape Better Auth's Drizzle adapter expects. User ids are text.
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  onboardedAt: ts('onboarded_at'),
  emailPrefs: jsonb('email_prefs')
    .$type<{ digest: boolean; events: boolean; proposals: boolean }>()
    .notNull()
    .default({ digest: true, events: true, proposals: true }),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Habitats
// ---------------------------------------------------------------------------

export const habitat = pgTable(
  'habitat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    emoji: text('emoji').notNull().default('🌿'),
    accent: text('accent').notNull().default('#e8590c'),
    coverMediaId: uuid('cover_media_id'),
    description: text('description'),
    governance: text('governance', { enum: ['majority', 'unanimous', 'admins'] })
      .notNull()
      .default('majority'),
    voteWindowHours: integer('vote_window_hours').notNull().default(48),
    memberCap: integer('member_cap').notNull().default(150),
    membersCanInvite: boolean('members_can_invite').notNull().default(true),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('habitat_slug_uq').on(t.slug)],
);

export const membership = pgTable(
  'membership',
  {
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    nickname: text('nickname'),
    joinedAt: ts('joined_at').notNull().defaultNow(),
    leftAt: ts('left_at'),
  },
  (t) => [
    primaryKey({ columns: [t.habitatId, t.userId] }),
    index('membership_user_idx').on(t.userId),
    uniqueIndex('membership_one_owner_uq')
      .on(t.habitatId)
      .where(sql`${t.role} = 'owner' AND ${t.leftAt} IS NULL`),
  ],
);

export const invite = pgTable(
  'invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    maxUses: integer('max_uses'),
    uses: integer('uses').notNull().default(0),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('invite_code_hash_uq').on(t.codeHash), index('invite_habitat_idx').on(t.habitatId)],
);

export const installedModule = pgTable(
  'installed_module',
  {
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    version: integer('version').notNull().default(1),
    position: integer('position').notNull().default(0),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    installedAt: ts('installed_at').notNull().defaultNow(),
    removedAt: ts('removed_at'),
    installedByProposalId: uuid('installed_by_proposal_id'),
  },
  (t) => [primaryKey({ columns: [t.habitatId, t.moduleId] })],
);

export const proposal = pgTable(
  'proposal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['install', 'uninstall', 'settings', 'governance'] }).notNull(),
    moduleId: text('module_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    reason: text('reason'),
    proposedBy: text('proposed_by').references(() => user.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['open', 'passed', 'rejected', 'withdrawn'] })
      .notNull()
      .default('open'),
    closesAt: ts('closes_at').notNull(),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('proposal_habitat_idx').on(t.habitatId, t.createdAt),
    uniqueIndex('proposal_one_open_per_module_uq')
      .on(t.habitatId, t.moduleId)
      .where(sql`${t.status} = 'open'`),
  ],
);

export const proposalVote = pgTable(
  'proposal_vote',
  {
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposal.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vote: text('vote', { enum: ['yes', 'no'] }).notNull(),
    votedAt: ts('voted_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Module data: one generic table, so custom and AI-built modules need no migrations.
// ---------------------------------------------------------------------------

export const record = pgTable(
  'record',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    collection: text('collection').notNull(),
    authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => record.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    uniqueKey: text('unique_key'),
    pinnedAt: ts('pinned_at'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    index('record_listing_idx').on(t.habitatId, t.moduleId, t.collection, t.createdAt.desc()),
    index('record_parent_idx').on(t.parentId),
    uniqueIndex('record_unique_key_uq')
      .on(t.habitatId, t.moduleId, t.collection, t.uniqueKey)
      .where(sql`${t.uniqueKey} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

export const comment = pgTable(
  'comment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id')
      .notNull()
      .references(() => record.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comment.id, {
      onDelete: 'cascade',
    }),
    authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
    editedAt: ts('edited_at'),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('comment_record_idx').on(t.recordId, t.createdAt)],
);

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🎉'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const reaction = pgTable(
  'reaction',
  {
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id')
      .notNull()
      .references(() => record.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    emoji: text('emoji', { enum: REACTIONS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.recordId, t.userId, t.emoji] })],
);

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    uploaderId: text('uploader_id').references(() => user.id, { onDelete: 'set null' }),
    keyFull: text('key_full').notNull(),
    keyThumb: text('key_thumb').notNull(),
    mime: text('mime', { enum: ['image/jpeg', 'image/webp', 'image/png'] }).notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    status: text('status', { enum: ['pending', 'ready'] })
      .notNull()
      .default('pending'),
    createdAt: createdAt(),
  },
  (t) => [index('media_habitat_idx').on(t.habitatId)],
);

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    recordId: uuid('record_id').references(() => record.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id').references(() => proposal.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts('read_at'),
    emailedAt: ts('emailed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notification_user_idx').on(t.userId, t.readAt, t.createdAt.desc())],
);

export const report = pgTable('report', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitatId: uuid('habitat_id')
    .notNull()
    .references(() => habitat.id, { onDelete: 'cascade' }),
  reporterId: text('reporter_id').references(() => user.id, { onDelete: 'set null' }),
  targetType: text('target_type', { enum: ['record', 'comment', 'member'] }).notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['open', 'resolved'] })
    .notNull()
    .default('open'),
  createdAt: createdAt(),
  resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitatId: uuid('habitat_id')
      .notNull()
      .references(() => habitat.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_habitat_idx').on(t.habitatId, t.createdAt.desc())],
);

export const rateLimit = pgTable(
  'rate_limit',
  {
    key: text('key').notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** Dev/test only (`EMAIL_TRANSPORT=outbox`): e2e reads magic links from here. */
export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull().default(''),
  createdAt: createdAt(),
});
