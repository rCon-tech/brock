import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const throwEnum = pgEnum('throw', ['rock', 'paper', 'scissors']);
export const roundResultEnum = pgEnum('round_result', ['win', 'loss', 'draw']);
export const brockStatusEnum = pgEnum('brock_status', ['pending', 'won', 'lost']);

/**
 * One row per browser that has played. There are no accounts: the player is identified by a
 * secret cookie, and only its SHA-256 is stored. The handle stays null until the player names
 * themselves after their first Brock.
 */
export const player = pgTable(
  'player',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    handle: varchar('handle', { length: 20 }),
    /** SHA-256 of the one-time recovery code shown when the handle was claimed. */
    recoveryHash: text('recovery_hash'),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    lastWinDay: date('last_win_day', { mode: 'string' }),
    totalWins: integer('total_wins').notNull().default(0),
    totalLosses: integer('total_losses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Handles are unique regardless of case. Unnamed players (NULL) never collide.
    uniqueIndex('player_handle_lower_idx').on(sql`lower(${t.handle})`),
    index('player_leaderboard_idx').on(t.lastWinDay, sql`${t.currentStreak} DESC`),
  ],
);

export const brock = pgTable(
  'brock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    status: brockStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  // One Brock per player per day, enforced by the database itself.
  (t) => [unique('brock_player_day_unique').on(t.playerId, t.day)],
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
