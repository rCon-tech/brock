import { sql } from 'drizzle-orm';
import { getDb, type Db } from '@/db';
import { utcDay, type Day } from './day';
import { clampLimit, type LeaderboardBoard } from './validation';

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
  /** Today board only: the run is still going, so the score can still climb. */
  playing: boolean;
}

export interface MyStanding {
  rank: number;
  score: number;
}

/**
 * One row per ranked player: today's runs (named players with at least one win today), or each
 * player's best run ever. Equal scores share a rank.
 */
function ranked(board: LeaderboardBoard, today: Day) {
  return board === 'today'
    ? sql`
        SELECT p.id, p.handle, b.score, b.status = 'pending' AS playing,
               RANK() OVER (ORDER BY b.score DESC) AS rank
        FROM brock b JOIN player p ON p.id = b.player_id
        WHERE b.day = ${today}::date AND b.score > 0 AND p.handle IS NOT NULL`
    : sql`
        SELECT p.id, p.handle, p.best_score AS score, false AS playing,
               RANK() OVER (ORDER BY p.best_score DESC) AS rank
        FROM player p
        WHERE p.best_score > 0 AND p.handle IS NOT NULL`;
}

interface Row extends Record<string, unknown> {
  id: string;
  handle: string;
  score: number;
  playing: boolean;
  rank: string;
}

/** Ordered by score, then handle A→Z. */
export async function topPlayers(
  board: LeaderboardBoard,
  limit = 100,
  today: Day = utcDay(new Date()),
  database: Db = getDb(),
): Promise<LeaderboardEntry[]> {
  const rows = await database.execute<Row>(sql`
    SELECT * FROM (${ranked(board, today)}) r
    ORDER BY r.score DESC, lower(r.handle) ASC
    LIMIT ${clampLimit(limit)}
  `);
  return Array.from(rows, (r) => ({
    rank: Number(r.rank),
    handle: r.handle,
    score: r.score,
    playing: r.playing,
  }));
}

/** The player's place on a board, or null if they're not on it. */
export async function rankOf(
  playerId: string,
  board: LeaderboardBoard,
  today: Day = utcDay(new Date()),
  database: Db = getDb(),
): Promise<MyStanding | null> {
  const [me] = await database.execute<Row>(sql`
    SELECT * FROM (${ranked(board, today)}) r WHERE r.id = ${playerId}
  `);
  return me ? { rank: Number(me.rank), score: me.score } : null;
}
