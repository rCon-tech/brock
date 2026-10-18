import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
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
export const rescueStatusEnum = pgEnum('rescue_status', ['offered', 'asked', 'passed', 'failed']);
export const quizStatusEnum = pgEnum('quiz_status', ['active', 'passed', 'failed']);
/** The all-or-nothing Brock offered after a quiz-won life is lost too. */
export const riskStatusEnum = pgEnum('risk_status', ['active', 'survived', 'lost']);

/**
 * A player. There are no accounts: each browser holds a secret cookie that maps to a player
 * through `player_session`. The handle stays null until the player names themselves after their
 * first Brock; after that, typing the handle on another device logs that device in too.
 */
export const player = pgTable(
  'player',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    handle: varchar('handle', { length: 20 }),
    /** Highest score of any single day's run: the all-time leaderboard. */
    bestScore: integer('best_score').notNull().default(0),
    /** Legacy (day-to-day streaks, before daily runs). Kept so history isn't destroyed; unused. */
    currentStreak: integer('current_streak').notNull().default(0),
    /** Legacy, unused. */
    bestStreak: integer('best_streak').notNull().default(0),
    /** Legacy, unused. */
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

/** One row per logged-in browser. Only the SHA-256 of the cookie token is stored. */
export const playerSession = pgTable(
  'player_session',
  {
    tokenHash: text('token_hash').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('player_session_player_idx').on(t.playerId)],
);

export const brock = pgTable(
  'brock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    /** 'pending' while the run is in play, 'lost' once it has ended. ('won' is legacy.) */
    status: brockStatusEnum('status').notNull().default('pending'),
    /** Rounds won in today's run: the day's score. */
    score: integer('score').notNull().default(0),
    /**
     * Null until the player risks their run (only after the quiz's extra life is spent). While
     * 'active' the next decided round doesn't score: a win keeps the run going ('survived'), a
     * loss drops the day's score to 0 ('lost').
     */
    risk: riskStatusEnum('risk'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  // One Brock per player per day, enforced by the database itself.
  (t) => [
    unique('brock_player_day_unique').on(t.playerId, t.day),
    // Today's leaderboard: the day's runs by score.
    index('brock_day_score_idx').on(t.day, sql`${t.score} DESC`),
  ],
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

/**
 * Legacy: the one-question lifeline from before daily runs. Kept so its rows aren't destroyed;
 * replaced by brock_quiz.
 *
 * The trivia lifeline, offered when a Brock is lost while on a streak. At most one per Brock, so
 * at most one per player per day. The correct answer never leaves the server until it's answered.
 */
export const brockRescue = pgTable('brock_rescue', {
  brockId: uuid('brock_id')
    .primaryKey()
    .references(() => brock.id, { onDelete: 'cascade' }),
  /** The streak the loss ended; restored if the question is answered correctly. */
  streakBefore: integer('streak_before').notNull(),
  status: rescueStatusEnum('status').notNull().default('offered'),
  questionId: text('question_id'),
  /** Answer options in the order the player saw them. */
  options: jsonb('options').$type<string[]>(),
  answerIndex: integer('answer_index'),
  chosenIndex: integer('chosen_index'),
  askedAt: timestamp('asked_at', { withTimezone: true }),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One question in a day's quiz, in the order shown. The answer stays on the server. */
export interface QuizItem {
  questionId: string;
  options: string[];
  answerIndex: number;
  /** The option chosen, or null if the clock ran out. Undefined until answered. */
  chosenIndex?: number | null;
}

/**
 * "Win another life": five themed questions, one try per day, taken after a run ends.
 * All five right reopens the run with its score intact.
 */
export const brockQuiz = pgTable('brock_quiz', {
  brockId: uuid('brock_id')
    .primaryKey()
    .references(() => brock.id, { onDelete: 'cascade' }),
  status: quizStatusEnum('status').notNull().default('active'),
  items: jsonb('items').$type<QuizItem[]>().notNull(),
  /** Index of the question on screen (equals items.length once all are answered). */
  currentIndex: integer('current_index').notNull().default(0),
  /** When the current question was shown; its 15-second clock starts here. */
  questionStartedAt: timestamp('question_started_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export type Player = typeof player.$inferSelect;
export type BrockRow = typeof brock.$inferSelect;
export type BrockRoundRow = typeof brockRound.$inferSelect;
export type BrockRescueRow = typeof brockRescue.$inferSelect;
export type BrockQuizRow = typeof brockQuiz.$inferSelect;
