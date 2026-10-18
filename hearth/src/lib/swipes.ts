import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { bridgeRound, catalogueItem, participant, project, swipe, veto } from '@/db/schema';
import type { Db } from '@/db';
import { shuffle } from '@/lib/engine/rng';
import { AppError, Conflict, NotFound } from '@/lib/errors';
import { newId } from '@/lib/ids';

export const swipeInput = z.object({
  clientId: z.string().min(8).max(64),
  itemId: z.string().min(1).max(64),
  round: z.enum(['macro', 'micro', 'bridge']),
  value: z.union([z.literal(1), z.literal(-1)]),
  decisionMs: z.number().int().min(0).max(600_000).optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export type SwipeInput = z.infer<typeof swipeInput>;

type Round = 'macro' | 'micro' | 'bridge';

async function load(db: Db, participantId: string) {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  const [proj] = await db.select().from(project).where(eq(project.id, me.projectId));
  return { me, proj };
}

/** Cards that may be swiped in a round: the deck plus its reserves (R33). */
async function allowedCards(
  db: Db,
  proj: typeof project.$inferSelect,
  round: Round,
): Promise<Set<string>> {
  if (round === 'macro') return new Set([...proj.macroDeck, ...proj.reserveMacro]);
  if (round === 'micro') return new Set([...proj.microDeck, ...proj.reserveMicro]);
  const rounds = await db.select().from(bridgeRound).where(eq(bridgeRound.projectId, proj.id));
  return new Set(rounds.flatMap((r) => r.itemIds));
}

export interface SaveResult {
  saved: number;
  /** Client ids that were not applied (wrong card, or the round was already finished). */
  rejected: string[];
}

/**
 * Saves a batch of swipes. Idempotent by `clientId` so the offline queue can retry freely (R32);
 * bad entries are rejected individually so one stale card never blocks the rest of a batch.
 */
export async function recordSwipes(
  db: Db,
  participantId: string,
  raw: SwipeInput[],
): Promise<SaveResult> {
  const swipes = raw.map((s) => swipeInput.parse(s));
  const { me, proj } = await load(db, participantId);
  const allowed: Record<Round, Set<string>> = {
    macro: await allowedCards(db, proj, 'macro'),
    micro: await allowedCards(db, proj, 'micro'),
    bridge: await allowedCards(db, proj, 'bridge'),
  };
  const rejected: string[] = [];
  const rows: (typeof swipe.$inferInsert)[] = [];
  for (const s of swipes) {
    const finished =
      (s.round === 'macro' && me.macroDoneAt) || (s.round === 'micro' && me.microDoneAt);
    if (finished || !allowed[s.round].has(s.itemId)) {
      rejected.push(s.clientId);
      continue;
    }
    rows.push({
      participantId,
      itemId: s.itemId,
      round: s.round,
      value: s.value,
      clientId: s.clientId,
      decisionMs: s.decisionMs ?? null,
      position: s.position ?? null,
    });
  }
  if (rows.length > 0) {
    await db
      .insert(swipe)
      .values(rows)
      .onConflictDoUpdate({
        target: [swipe.participantId, swipe.itemId, swipe.round],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }
  return { saved: rows.length, rejected };
}

/** Undo the last swipe. If it was a veto, the veto token comes back too. */
export async function undoSwipe(db: Db, participantId: string, itemId: string): Promise<void> {
  const { me } = await load(db, participantId);
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({ tier: catalogueItem.tier })
      .from(catalogueItem)
      .where(eq(catalogueItem.id, itemId));
    if (!item) return;
    const round: Round = item.tier;
    if ((round === 'macro' && me.macroDoneAt) || (round === 'micro' && me.microDoneAt)) {
      throw new AppError("You've already finished this round.");
    }
    const removed = await tx
      .delete(veto)
      .where(and(eq(veto.participantId, participantId), eq(veto.itemId, itemId)))
      .returning({ id: veto.id });
    if (removed.length > 0) {
      await tx
        .update(participant)
        .set({ vetoesLeft: sql`${participant.vetoesLeft} + ${removed.length}` })
        .where(eq(participant.id, participantId));
    }
    await tx
      .delete(swipe)
      .where(and(eq(swipe.participantId, participantId), eq(swipe.itemId, itemId)));
  });
}

export const MAX_VETOES = 3;

export async function recordVeto(
  db: Db,
  participantId: string,
  input: { itemId: string; attribute?: string | null; clientId: string },
): Promise<{ vetoesLeft: number }> {
  const { me, proj } = await load(db, participantId);
  const [item] = await db
    .select({ tier: catalogueItem.tier, attributes: catalogueItem.attributes })
    .from(catalogueItem)
    .where(eq(catalogueItem.id, input.itemId));
  if (!item) throw new NotFound();
  const round: Round = item.tier;
  const allowed = await allowedCards(db, proj, round);
  if (!allowed.has(input.itemId)) throw new AppError("That card isn't in this room's deck.");
  if (input.attribute && !item.attributes.includes(input.attribute)) {
    throw new AppError("That isn't one of this card's features.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(veto)
      .where(and(eq(veto.participantId, participantId), eq(veto.itemId, input.itemId)));
    if (existing) return { vetoesLeft: me.vetoesLeft };
    const [fresh] = await tx.select().from(participant).where(eq(participant.id, participantId));
    if (fresh.vetoesLeft <= 0) throw new Conflict("You've used all your vetoes.");
    await tx.insert(veto).values({
      id: newId(),
      participantId,
      itemId: input.itemId,
      attribute: input.attribute ?? null,
    });
    await tx
      .update(participant)
      .set({ vetoesLeft: fresh.vetoesLeft - 1 })
      .where(eq(participant.id, participantId));
    await tx
      .insert(swipe)
      .values({
        participantId,
        itemId: input.itemId,
        round,
        value: -1,
        clientId: input.clientId,
      })
      .onConflictDoUpdate({
        target: [swipe.participantId, swipe.itemId, swipe.round],
        set: { value: -1, updatedAt: new Date() },
      });
    return { vetoesLeft: fresh.vetoesLeft - 1 };
  });
}

/** Marks a round finished once every deck card has an answer (reserves can stand in for failed cards). */
export async function finishRound(db: Db, participantId: string, round: 'macro' | 'micro') {
  const { me, proj } = await load(db, participantId);
  const deck = round === 'macro' ? proj.macroDeck : proj.microDeck;
  const allowed = await allowedCards(db, proj, round);
  const rows = await db
    .select({ itemId: swipe.itemId })
    .from(swipe)
    .where(and(eq(swipe.participantId, participantId), eq(swipe.round, round)));
  const answered = rows.filter((r) => allowed.has(r.itemId)).length;
  if (answered < deck.length) throw new AppError('There are still cards to swipe.');
  const now = new Date();
  await db
    .update(participant)
    .set(
      round === 'macro'
        ? { macroDoneAt: me.macroDoneAt ?? now }
        : { microDoneAt: me.microDoneAt ?? now },
    )
    .where(eq(participant.id, participantId));
  const [updated] = await db.select().from(participant).where(eq(participant.id, participantId));
  return updated;
}

/** Wipe your own swipes and vetoes and redo the deck. Only until the board is out (R31). */
export async function startOver(db: Db, participantId: string): Promise<void> {
  const { proj } = await load(db, participantId);
  if (proj.revealedAt) throw new AppError('The board is already out.');
  await db.transaction(async (tx) => {
    await tx.delete(swipe).where(eq(swipe.participantId, participantId));
    await tx.delete(veto).where(eq(veto.participantId, participantId));
    await tx
      .update(participant)
      .set({ macroDoneAt: null, microDoneAt: null, readyAt: null, vetoesLeft: MAX_VETOES })
      .where(eq(participant.id, participantId));
  });
}

export interface DeckState {
  macro: string[];
  micro: string[];
  /** Cards not yet answered, in this person's own order (the same cards for everyone, R7). */
  remainingMacro: string[];
  remainingMicro: string[];
  reserveMacro: string[];
  reserveMicro: string[];
  swiped: { itemId: string; round: Round; value: number }[];
  vetoesLeft: number;
  macroDone: boolean;
  microDone: boolean;
}

export async function getDeckState(db: Db, participantId: string): Promise<DeckState> {
  const { me, proj } = await load(db, participantId);
  const rows = await db
    .select({ itemId: swipe.itemId, round: swipe.round, value: swipe.value })
    .from(swipe)
    .where(eq(swipe.participantId, participantId));
  const answered = new Set(rows.map((r) => r.itemId));
  const order = (ids: string[], salt: string) =>
    shuffle(ids, `${proj.deckSeed}:${participantId}:${salt}`);
  const macro = order(proj.macroDeck, 'macro');
  const micro = order(proj.microDeck, 'micro');
  return {
    macro,
    micro,
    remainingMacro: macro.filter((id) => !answered.has(id)),
    remainingMicro: micro.filter((id) => !answered.has(id)),
    reserveMacro: proj.reserveMacro.filter((id) => !answered.has(id)),
    reserveMicro: proj.reserveMicro.filter((id) => !answered.has(id)),
    swiped: rows,
    vetoesLeft: me.vetoesLeft,
    macroDone: !!me.macroDoneAt,
    microDone: !!me.microDoneAt,
  };
}

export async function swipesForParticipants(db: Db, participantIds: string[]) {
  if (participantIds.length === 0) return [];
  return db.select().from(swipe).where(inArray(swipe.participantId, participantIds));
}
