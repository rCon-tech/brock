import { and, count, eq, gt, gte, isNotNull, or, sql } from 'drizzle-orm';
import { getDb, schema, type Db } from '@/db';
import { previousDay, utcDay, type Day } from './day';
import { clampLimit } from './validation';

const { player } = schema;

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  currentStreak: number;
  bestStreak: number;
}

export interface MyStanding {
  rank: number;
  streak: number;
}

/**
 * Players on the board have a live streak: they won today or yesterday, so a lapsed streak
 * (last win 2+ days ago) is excluded even though its stored value hasn't been reset yet.
 */
function onBoard(today: Day) {
  return and(
    isNotNull(player.handle),
    gt(player.currentStreak, 0),
    gte(player.lastWinDay, previousDay(today)),
  );
}

/**
 * Ordered by current streak, then best streak, then handle A→Z. Players tied on
 * (current, best) share a rank.
 */
export async function topPlayers(
  limit = 100,
  today: Day = utcDay(new Date()),
  database: Db = getDb(),
): Promise<LeaderboardEntry[]> {
  const rows = await database.execute<{
    handle: string;
    current_streak: number;
    best_streak: number;
    rank: string;
  }>(sql`
    SELECT handle, current_streak, best_streak,
           RANK() OVER (ORDER BY current_streak DESC, best_streak DESC) AS rank
    FROM player
    WHERE handle IS NOT NULL AND current_streak > 0 AND last_win_day >= ${previousDay(today)}::date
    ORDER BY current_streak DESC, best_streak DESC, lower(handle) ASC
    LIMIT ${clampLimit(limit)}
  `);

  return Array.from(rows, (r) => ({
    rank: Number(r.rank),
    handle: r.handle,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
  }));
}

/** 1 + the number of players with a strictly better (streak, best). Null if not on the board. */
export async function rankOf(
  playerId: string,
  today: Day = utcDay(new Date()),
  database: Db = getDb(),
): Promise<MyStanding | null> {
  const [me] = await database
    .select()
    .from(player)
    .where(and(eq(player.id, playerId), onBoard(today)));
  if (!me) return null;

  const [{ better }] = await database
    .select({ better: count() })
    .from(player)
    .where(
      and(
        onBoard(today),
        or(
          gt(player.currentStreak, me.currentStreak),
          and(eq(player.currentStreak, me.currentStreak), gt(player.bestStreak, me.bestStreak)),
        ),
      ),
    );

  return { rank: better + 1, streak: me.currentStreak };
}
