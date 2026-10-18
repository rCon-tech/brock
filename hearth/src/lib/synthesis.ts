import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  bridgeRound,
  itemReaction,
  participant,
  pickSwap,
  project,
  shoppingListItem,
  swipe,
  synthesis,
  veto,
} from '@/db/schema';
import type { Db } from '@/db';
import { fallbackNaming, type BridgeNaming } from '@/lib/ai/bridge-fallback';
import {
  loadCentroids,
  loadEngineItems,
  loadEngineItemsById,
  loadStatsBoost,
} from '@/lib/catalogue/load';
import { applyBoardSignals } from '@/lib/engine/feedback';
import { inputsHash, synthesise } from '@/lib/engine/synthesise';
import type { EngineItem, Person, SynthesisResult } from '@/lib/engine/types';
import { NotFound } from '@/lib/errors';

export type SynthesisRow = typeof synthesis.$inferSelect;
export type Namer = (result: SynthesisResult) => Promise<BridgeNaming & { model?: string | null }>;

export function isFinished(p: { macroDoneAt: Date | null; microDoneAt: Date | null }): boolean {
  return !!p.macroDoneAt && !!p.microDoneAt;
}

async function loadPeople(
  db: Db,
  participantIds: string[],
  names: Map<string, string>,
): Promise<Person[]> {
  if (participantIds.length === 0) return [];
  const swipes = await db.select().from(swipe).where(inArray(swipe.participantId, participantIds));
  const vetoes = await db.select().from(veto).where(inArray(veto.participantId, participantIds));
  return participantIds.map((id) => ({
    id,
    name: names.get(id) ?? 'Someone',
    swipes: swipes
      .filter((s) => s.participantId === id)
      .map((s) => ({ itemId: s.itemId, value: s.value as 1 | -1, round: s.round })),
    vetoes: vetoes
      .filter((v) => v.participantId === id)
      .map((v) => ({ itemId: v.itemId, attribute: v.attribute })),
  }));
}

/** Engine items for a project: this room's live catalogue plus anything on the deck that has since been retired. */
export async function projectItems(
  db: Db,
  proj: typeof project.$inferSelect,
): Promise<EngineItem[]> {
  const live = await loadEngineItems(db, proj.roomType);
  const have = new Set(live.map((i) => i.id));
  const missing = [
    ...proj.macroDeck,
    ...proj.microDeck,
    ...proj.reserveMacro,
    ...proj.reserveMicro,
  ].filter((id) => !have.has(id));
  return [...live, ...(await loadEngineItemsById(db, missing))];
}

export async function latestSynthesis(db: Db, projectId: string): Promise<SynthesisRow | null> {
  const [row] = await db
    .select()
    .from(synthesis)
    .where(eq(synthesis.projectId, projectId))
    .orderBy(desc(synthesis.version))
    .limit(1);
  return row ?? null;
}

/** Reactions and swaps feed back into the next recompute as extra swipes (§11.3). */
async function boardSignals(db: Db, projectId: string) {
  const reactions = await db
    .select()
    .from(itemReaction)
    .where(eq(itemReaction.projectId, projectId));
  const swaps = await db
    .select()
    .from(pickSwap)
    .where(and(eq(pickSwap.projectId, projectId), isNull(pickSwap.undoneAt)));
  return {
    reactions: reactions.map((r) => ({
      participantId: r.participantId,
      itemId: r.itemId,
      reaction: r.reaction,
    })),
    swapsOut: swaps.map((s) => ({ participantId: s.byParticipantId, itemId: s.fromItemId })),
  };
}

/**
 * Builds the board for everyone who has finished swiping and stores it as the next version.
 * Skips the work when nothing that affects the board has changed.
 */
export async function computeSynthesis(
  db: Db,
  projectId: string,
): Promise<{ version: number; changed: boolean } | null> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  const all = await db.select().from(participant).where(eq(participant.projectId, projectId));
  const finished = all.filter(isFinished);
  if (finished.length === 0) return null;

  const names = new Map(all.map((p) => [p.id, p.displayName]));
  const base = await loadPeople(
    db,
    finished.map((p) => p.id),
    names,
  );
  const people = applyBoardSignals(base, await boardSignals(db, projectId));

  const hashInput = {
    roomType: proj.roomType,
    context: proj.context,
    budgetBand: proj.budgetBand,
    people,
  };
  const hash = inputsHash(hashInput);
  const latest = await latestSynthesis(db, projectId);
  if (latest && latest.inputsHash === hash) return { version: latest.version, changed: false };

  const items = await projectItems(db, proj);
  const result = synthesise({
    ...hashInput,
    items,
    centroids: await loadCentroids(db, items),
    statsBoost: await loadStatsBoost(db),
  });

  const version = (latest?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(synthesis).values({
      projectId,
      version,
      inputsHash: hash,
      status: 'computing',
      result,
    });
    // Agreed items go on the shopping list; items that became agreed in a tie-breaker say so.
    const rounds = await tx.select().from(bridgeRound).where(eq(bridgeRound.projectId, projectId));
    const bridgeIds = new Set(rounds.flatMap((r) => r.itemIds));
    if (!result.solo && result.exactMicro.length > 0) {
      await tx
        .insert(shoppingListItem)
        .values(
          result.exactMicro.map((itemId) => ({
            projectId,
            itemId,
            source: bridgeIds.has(itemId) ? ('tiebreak' as const) : ('agreed' as const),
          })),
        )
        .onConflictDoNothing();
    }
  });
  return { version, changed: true };
}

/** Writes the name, tagline and explanation. A failed AI call falls back to plain wording. */
export async function nameSynthesis(
  db: Db,
  projectId: string,
  version: number,
  namer?: Namer,
): Promise<void> {
  const [row] = await db
    .select()
    .from(synthesis)
    .where(and(eq(synthesis.projectId, projectId), eq(synthesis.version, version)));
  if (!row || row.status === 'ready') return;
  let naming: BridgeNaming & { model?: string | null };
  try {
    naming = namer ? await namer(row.result) : { ...fallbackNaming(row.result), model: null };
  } catch (error) {
    console.error('Bridge naming failed, using fallback:', error);
    naming = { ...fallbackNaming(row.result), model: null };
  }
  await db
    .update(synthesis)
    .set({
      status: 'ready',
      bridgeName: naming.name,
      tagline: naming.tagline,
      rationale: naming.rationale,
      contributions: naming.contributions,
      aiModel: naming.model ?? null,
    })
    .where(and(eq(synthesis.projectId, projectId), eq(synthesis.version, version)));
}

/** Compute and name in one go. Used by tests and by code that can wait. */
export async function synthesiseAndName(db: Db, projectId: string, namer?: Namer) {
  const out = await computeSynthesis(db, projectId);
  if (out?.changed) await nameSynthesis(db, projectId, out.version, namer);
  return out;
}

/** A board built from one person's swipes only, not stored (R31). */
export async function soloSynthesis(db: Db, projectId: string, participantId: string) {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  const all = await db.select().from(participant).where(eq(participant.projectId, projectId));
  const names = new Map(all.map((p) => [p.id, p.displayName]));
  const base = await loadPeople(db, [participantId], names);
  const people = applyBoardSignals(base, await boardSignals(db, projectId));
  const items = await projectItems(db, proj);
  const result = synthesise({
    roomType: proj.roomType,
    context: proj.context,
    budgetBand: proj.budgetBand,
    people,
    items,
    centroids: await loadCentroids(db, items),
    statsBoost: await loadStatsBoost(db),
  });
  return { result, naming: fallbackNaming(result) };
}
