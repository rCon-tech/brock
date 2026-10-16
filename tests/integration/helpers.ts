import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getToday, submitThrow } from '@/lib/brock-service';
import { utcDay } from '@/lib/day';
import { commit } from '@/lib/fairness';
import type { Throw } from '@/lib/game';

const { brock, brockQuiz, brockRound, player } = schema;

export const at = (day: string, time = '10:00:00') => new Date(`${day}T${time}Z`);

/** The House throw each throw beats, and the one it loses to. */
export const BEATS: Record<Throw, Throw> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
export const LOSES_TO: Record<Throw, Throw> = {
  rock: 'paper',
  paper: 'scissors',
  scissors: 'rock',
};

export async function brockRow(playerId: string, now: Date) {
  const [row] = await getDb()
    .select()
    .from(brock)
    .where(and(eq(brock.playerId, playerId), eq(brock.day, utcDay(now))));
  return row;
}

/**
 * Plays `mine` against the open round after fixing the House's throw to `house` (and re-committing
 * to it), so outcomes are deterministic even for rounds that were created earlier.
 */
export async function play(playerId: string, now: Date, mine: Throw, house: Throw) {
  const state = await getToday(playerId, now);
  const today = await brockRow(playerId, now);
  const [open] = await getDb()
    .select()
    .from(brockRound)
    .where(and(eq(brockRound.brockId, today.id), isNull(brockRound.playerThrow)));
  await getDb()
    .update(brockRound)
    .set({ houseThrow: house, commitHash: commit(house, open.salt) })
    .where(eq(brockRound.id, open.id));
  return submitThrow(playerId, { roundNo: state.openRound!.roundNo, throw: mine }, now);
}

export const win = (id: string, now: Date) => play(id, now, 'rock', BEATS.rock);
export const lose = (id: string, now: Date) => play(id, now, 'rock', LOSES_TO.rock);
export const draw = (id: string, now: Date) => play(id, now, 'rock', 'rock');

export async function playerRow(id: string) {
  const [row] = await getDb().select().from(player).where(eq(player.id, id));
  return row;
}

/** Today's quiz row, straight from the database (answers included). */
export async function quizRow(playerId: string, now: Date) {
  const today = await brockRow(playerId, now);
  const [row] = await getDb().select().from(brockQuiz).where(eq(brockQuiz.brockId, today.id));
  return row ?? null;
}
