import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { itemReaction, participant, pickSwap, project, swipe, synthesis, veto } from '@/db/schema';
import type { Db } from '@/db';
import { loadCentroids, loadEngineItems, loadEngineItemsById } from '@/lib/catalogue/load';
import { describePick } from '@/lib/engine/compromise';
import { buildProfile } from '@/lib/engine/profile';
import { nextSwap } from '@/lib/engine/swap';
import type { SynthesisResult } from '@/lib/engine/types';
import { AppError, NotFound } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { isFinished, latestSynthesis } from '@/lib/synthesis';

/** How long "Undo" works after a swap (R28). The client shows 10 s; the server is a little kinder. */
export const UNDO_WINDOW_MS = 60_000;

export interface SwapOutcome {
  swapId: string | null;
  from: string;
  to: string | null;
  /** True when the category has no more candidates at this budget. */
  exhausted: boolean;
}

/** Replaces one pick with the next-best item in the same category, instantly (R28). */
export async function swapPick(
  db: Db,
  participantId: string,
  itemId: string,
): Promise<SwapOutcome> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  const latest = await latestSynthesis(db, me.projectId);
  if (!latest) throw new AppError('The board is not ready yet.');
  const result = latest.result;
  const current = result.picks.find((p) => p.itemId === itemId);
  if (!current) throw new AppError("That item isn't one of the suggestions.");

  const swaps = await db
    .select()
    .from(pickSwap)
    .where(and(eq(pickSwap.projectId, me.projectId), isNull(pickSwap.undoneAt)));
  const reactions = await db
    .select()
    .from(itemReaction)
    .where(eq(itemReaction.projectId, me.projectId));
  const people = (
    await db.select().from(participant).where(eq(participant.projectId, me.projectId))
  ).filter(isFinished);
  const vetoes = people.length
    ? await db
        .select()
        .from(veto)
        .where(
          inArray(
            veto.participantId,
            people.map((p) => p.id),
          ),
        )
    : [];
  const unavailable = new Set<string>([
    ...swaps.flatMap((s) => [s.fromItemId, s.toItemId].filter((x): x is string => !!x)),
    ...reactions.filter((r) => r.reaction === 'no').map((r) => r.itemId),
    ...vetoes.map((v) => v.itemId),
  ]);

  const next = nextSwap(result, current.category, unavailable);
  if (!next.itemId) return { swapId: null, from: itemId, to: null, exhausted: true };

  const [proj] = await db.select().from(project).where(eq(project.id, me.projectId));
  const [item] = await loadEngineItemsById(db, [next.itemId]);
  if (!item) return { swapId: null, from: itemId, to: null, exhausted: true };

  // Fit is internal, but keep it honest: rebuild the profiles the board was built from.
  const live = await loadEngineItems(db, proj.roomType);
  const itemsById = new Map(live.map((i) => [i.id, i]));
  const swipes = people.length
    ? await db
        .select()
        .from(swipe)
        .where(
          inArray(
            swipe.participantId,
            people.map((p) => p.id),
          ),
        )
    : [];
  for (const s of swipes) {
    if (!itemsById.has(s.itemId)) {
      const [extra] = await loadEngineItemsById(db, [s.itemId]);
      if (extra) itemsById.set(extra.id, extra);
    }
  }
  const centroids = await loadCentroids(db, live);
  const profiles = people.map((p) =>
    buildProfile(
      {
        id: p.id,
        name: p.displayName,
        swipes: swipes
          .filter((s) => s.participantId === p.id)
          .map((s) => ({ itemId: s.itemId, value: s.value as 1 | -1, round: s.round })),
        vetoes: vetoes
          .filter((v) => v.participantId === p.id)
          .map((v) => ({ itemId: v.itemId, attribute: v.attribute })),
      },
      itemsById,
      centroids,
    ),
  );
  const replacement = describePick(item, profiles, proj.context);

  const updated: SynthesisResult = {
    ...result,
    picks: result.picks.map((p) => (p.itemId === itemId ? replacement : p)),
    swapQueue: { ...result.swapQueue, [current.category]: next.remaining },
  };
  const swapId = newId();
  await db.transaction(async (tx) => {
    await tx
      .update(synthesis)
      .set({ result: updated })
      .where(and(eq(synthesis.projectId, me.projectId), eq(synthesis.version, latest.version)));
    await tx.insert(pickSwap).values({
      id: swapId,
      projectId: me.projectId,
      synthesisVersion: latest.version,
      category: current.category,
      fromItemId: itemId,
      toItemId: next.itemId,
      fromPick: current,
      byParticipantId: participantId,
    });
  });
  return { swapId, from: itemId, to: next.itemId, exhausted: false };
}

/** Puts the original pick back, if the swap is recent and still the latest change (R28). */
export async function undoSwap(db: Db, participantId: string, swapId: string): Promise<void> {
  const [swap] = await db.select().from(pickSwap).where(eq(pickSwap.id, swapId));
  if (!swap || swap.byParticipantId !== participantId || swap.undoneAt) throw new NotFound();
  if (Date.now() - swap.createdAt.getTime() > UNDO_WINDOW_MS)
    throw new AppError('Too late to undo that swap.');
  const [row] = await db
    .select()
    .from(synthesis)
    .where(
      and(eq(synthesis.projectId, swap.projectId), eq(synthesis.version, swap.synthesisVersion)),
    )
    .orderBy(desc(synthesis.version));
  if (!row) throw new NotFound();
  const result = row.result;
  const replacement = result.picks.find((p) => p.itemId === swap.toItemId);
  if (!replacement || !swap.toItemId) throw new AppError('That swap can no longer be undone.');
  const updated: SynthesisResult = {
    ...result,
    picks: result.picks.map((p) => (p.itemId === swap.toItemId ? swap.fromPick : p)),
    swapQueue: {
      ...result.swapQueue,
      [swap.category]: [swap.toItemId, ...(result.swapQueue[swap.category] ?? [])],
    },
  };
  await db.transaction(async (tx) => {
    await tx
      .update(synthesis)
      .set({ result: updated })
      .where(
        and(eq(synthesis.projectId, swap.projectId), eq(synthesis.version, swap.synthesisVersion)),
      );
    await tx.update(pickSwap).set({ undoneAt: new Date() }).where(eq(pickSwap.id, swapId));
  });
}
