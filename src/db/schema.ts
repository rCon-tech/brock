import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Auth tables (shape dictated by Better Auth)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Game tables
// ---------------------------------------------------------------------------

export const throwEnum = pgEnum('throw', ['rock', 'paper', 'scissors']);
export const roundResultEnum = pgEnum('round_result', ['win', 'loss', 'draw']);
export const brockStatusEnum = pgEnum('brock_status', ['pending', 'won', 'lost']);

export const player = pgTable(
  'player',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    handle: varchar('handle', { length: 20 }).notNull().unique(),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    lastWinDay: date('last_win_day', { mode: 'string' }),
    totalWins: integer('total_wins').notNull().default(0),
    totalLosses: integer('total_losses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Handles are unique regardless of case.
    uniqueIndex('player_handle_lower_idx').on(sql`lower(${t.handle})`),
    index('player_leaderboard_idx').on(t.lastWinDay, sql`${t.currentStreak} DESC`),
  ],
);

export const brock = pgTable(
  'brock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => player.userId, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    status: brockStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  // One Brock per player per day, enforced by the database itself.
  (t) => [unique('brock_user_day_unique').on(t.userId, t.day)],
);

export const brockRound = pgTable(
  'brock_round',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brockId: uuid('brock_id')
      .notNull()
      .references(() => brock.id, { onDelete: 'cascade' }),
    roundNo: integer('round_no').notNull(),
    houseThrow: throwEnum('house_throw').notNull(),
    salt: text('salt').notNull(),
    commitHash: text('commit_hash').notNull(),
    playerThrow: throwEnum('player_throw'),
    result: roundResultEnum('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revealedAt: timestamp('revealed_at', { withTimezone: true }),
  },
  (t) => [unique('brock_round_brock_no_unique').on(t.brockId, t.roundNo)],
);

export type Player = typeof player.$inferSelect;
export type BrockRow = typeof brock.$inferSelect;
export type BrockRoundRow = typeof brockRound.$inferSelect;
