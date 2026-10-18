import { eq, inArray } from 'drizzle-orm';
import { bridgeRound, participant, project, swipe } from '@/db/schema';
import type { Db } from '@/db';
import { MAX_TIEBREAK_ROUNDS, tiebreakCards } from '@/lib/engine/tiebreak';
import { AppError, NotFound } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { computeSynthesis, isFinished, latestSynthesis } from '@/lib/synthesis';

export interface TiebreakState {
  roundsUsed: number;
  maxRounds: number;
  /** The open round's cards, if any. */
  current: { id: string; itemIds: string[] } | null;
  /** Cards in the open round this person hasn't answered. */
  remaining: string[];
  canStart: boolean;
}

async function rounds(db: Db, projectId: string) {
  return db
    .select()
    .from(bridgeRound)
    .where(eq(bridgeRound.projectId, projectId))
    .orderBy(bridgeRound.createdAt);
}

async function answersByPerson(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(swipe).where(inArray(swipe.participantId, ids));
}

/** Starts an optional tie-breaker round of compromise picks nobody has swiped yet (R11). */
export async function startTiebreak(
  db: Db,
  projectId: string,
): Promise<{ id: string; itemIds: string[] }> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  if (!proj.revealedAt) throw new AppError('The board is not out yet.');
  const used = await rounds(db, projectId);
  if (used.length >= MAX_TIEBREAK_ROUNDS)
    throw new AppError('You’ve already used both tie-breaker rounds.');
  const state = await openRound(db, projectId);
  if (state) throw new AppError('A tie-breaker round is already open.');
  const latest = await latestSynthesis(db, projectId);
  if (!latest) throw new AppError('The board is not ready yet.');

  const people = (
    await db.select().from(participant).where(eq(participant.projectId, projectId))
  ).filter(isFinished);
  const swiped = new Set(
    (
      await answersByPerson(
        db,
        people.map((p) => p.id),
      )
    ).map((s) => s.itemId),
  );
  const cards = tiebreakCards(latest.result, swiped, new Set(used.flatMap((r) => r.itemIds)));
  if (cards.length === 0) throw new AppError('There are no more suggestions to test.');
  const id = newId();
  await db.insert(bridgeRound).values({
    id,
    projectId,
    synthesisVersion: latest.version,
    itemIds: cards,
  });
  return { id, itemIds: cards };
}

/** The latest round, if someone still owes answers on it. */
async function openRound(db: Db, projectId: string) {
  const all = await rounds(db, projectId);
  const last = all[all.length - 1];
  if (!last) return null;
  const people = (
    await db.select().from(participant).where(eq(participant.projectId, projectId))
  ).filter(isFinished);
  const answers = await answersByPerson(
    db,
    people.map((p) => p.id),
  );
  const done = people.every((p) =>
    last.itemIds.every((id) =>
      answers.some((a) => a.participantId === p.id && a.itemId === id && a.round === 'bridge'),
    ),
  );
  return done ? null : last;
}

export async function tiebreakState(
  db: Db,
  projectId: string,
  participantId: string,
): Promise<TiebreakState> {
  const all = await rounds(db, projectId);
  const open = await openRound(db, projectId);
  const mine = open ? await answersByPerson(db, [participantId]) : [];
  return {
    roundsUsed: all.length,
    maxRounds: MAX_TIEBREAK_ROUNDS,
    current: open ? { id: open.id, itemIds: open.itemIds } : null,
    remaining: open
      ? open.itemIds.filter((id) => !mine.some((a) => a.itemId === id && a.round === 'bridge'))
      : [],
    canStart: all.length < MAX_TIEBREAK_ROUNDS && !open,
  };
}

/**
 * Call after bridge-round swipes. When everyone has answered every card, the board is rebuilt so
 * mutual yeses move into Agreed. The caller names the new version (it can run after the response).
 */
export async function afterBridgeSwipes(
  db: Db,
  projectId: string,
): Promise<{ rebuilt: boolean; version?: number }> {
  const all = await rounds(db, projectId);
  if (all.length === 0) return { rebuilt: false };
  if (await openRound(db, projectId)) return { rebuilt: false };
  const out = await computeSynthesis(db, projectId);
  return out?.changed ? { rebuilt: true, version: out.version } : { rebuilt: false };
}
