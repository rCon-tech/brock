import { and, eq, inArray } from 'drizzle-orm';
import {
  boardFeedback,
  itemReaction,
  participant,
  pickSwap,
  project,
  shoppingListItem,
} from '@/db/schema';
import type { Db } from '@/db';
import { fallbackNaming } from '@/lib/ai/bridge-fallback';
import { loadItemCards, type ItemCard } from '@/lib/catalogue/load';
import type { SynthesisResult } from '@/lib/engine/types';
import { NotFound } from '@/lib/errors';
import { soloBoardAllowed } from '@/lib/reveal';
import { shoppingTotal, type ShoppingTotal } from '@/lib/shopping';
import { isFinished, latestSynthesis, soloSynthesis } from '@/lib/synthesis';
import { tiebreakState, type TiebreakState } from '@/lib/tiebreak';

export interface BoardView {
  project: {
    id: string;
    roomType: string;
    name: string | null;
    budgetBand: string | null;
    mode: string;
    revealed: boolean;
    context: (typeof project.$inferSelect)['context'];
    previousProjectId: string | null;
  };
  viewer: { id: string; name: string; isCreator: boolean };
  participants: { id: string; name: string; finished: boolean }[];
  /** `shared` once revealed; `solo` for a board built from the viewer's swipes alone (R31). */
  kind: 'shared' | 'solo';
  /** Version number of the stored board; changes when it is rebuilt. */
  version: number;
  naming: {
    ready: boolean;
    name: string;
    tagline: string;
    rationale: string;
    contributions: { participantId: string; brings: string }[];
  };
  result: SynthesisResult;
  items: Record<string, ItemCard>;
  reactions: Record<
    string,
    { participantId: string; reaction: 'love' | 'unsure' | 'no'; note: string | null }[]
  >;
  /** Items someone marked ✕ or that were swapped away: shown collapsed as "Not for us". */
  notForUs: string[];
  shopping: { itemId: string; source: string; bought: boolean }[];
  total: ShoppingTotal;
  tiebreak: TiebreakState;
  feedback: boolean | null;
  /** Set when the board changed since the viewer last looked (e.g. a late joiner finished). */
  joinedLate: string[];
}

/** Everything the board page needs, shaped for the UI. Null if there is nothing to show yet. */
export async function getBoard(
  db: Db,
  projectId: string,
  viewerParticipantId: string,
): Promise<BoardView | null> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  const people = await db.select().from(participant).where(eq(participant.projectId, projectId));
  const me = people.find((p) => p.id === viewerParticipantId);
  if (!me) throw new NotFound();

  let kind: 'shared' | 'solo' = 'shared';
  let result: SynthesisResult;
  let naming: BoardView['naming'];
  let version = 0;

  const latest = proj.revealedAt ? await latestSynthesis(db, projectId) : null;
  if (latest) {
    result = latest.result;
    version = latest.version;
    const fb = fallbackNaming(result);
    naming = {
      ready: latest.status === 'ready',
      name: latest.bridgeName ?? fb.name,
      tagline: latest.tagline ?? fb.tagline,
      rationale: latest.rationale ?? fb.rationale,
      contributions: latest.contributions ?? fb.contributions,
    };
  } else if (soloBoardAllowed(proj, me, people)) {
    kind = 'solo';
    const solo = await soloSynthesis(db, projectId, viewerParticipantId);
    result = solo.result;
    naming = { ready: true, ...solo.naming };
  } else {
    return null;
  }

  const ids = new Set<string>([
    ...result.picks.map((p) => p.itemId),
    ...result.exactMicro,
    ...result.exactMacro,
    ...result.hybridRooms,
    ...result.vetoedItemIds,
    ...result.shared.flatMap((s) => Object.values(s.evidence).flat()),
  ]);
  const reactions = await db
    .select()
    .from(itemReaction)
    .where(eq(itemReaction.projectId, projectId));
  const swaps = await db
    .select()
    .from(pickSwap)
    .where(and(eq(pickSwap.projectId, projectId)));
  const shopping = await db
    .select()
    .from(shoppingListItem)
    .where(eq(shoppingListItem.projectId, projectId));
  for (const s of shopping) ids.add(s.itemId);
  const items = await loadItemCards(db, [...ids]);

  const byItem: BoardView['reactions'] = {};
  for (const r of reactions) {
    (byItem[r.itemId] ??= []).push({
      participantId: r.participantId,
      reaction: r.reaction,
      note: r.note,
    });
  }
  const swappedAway = swaps.filter((s) => !s.undoneAt).map((s) => s.fromItemId);
  const rejected = reactions.filter((r) => r.reaction === 'no').map((r) => r.itemId);
  const [fb] = await db
    .select()
    .from(boardFeedback)
    .where(
      and(
        eq(boardFeedback.projectId, projectId),
        eq(boardFeedback.participantId, viewerParticipantId),
      ),
    );

  const lateIds = people
    .filter((p) => p.joinedAfterReveal && isFinished(p))
    .map((p) => p.displayName);

  return {
    project: {
      id: proj.id,
      roomType: proj.roomType,
      name: proj.name,
      budgetBand: proj.budgetBand,
      mode: proj.mode,
      revealed: !!proj.revealedAt,
      context: proj.context,
      previousProjectId: proj.previousProjectId,
    },
    viewer: { id: me.id, name: me.displayName, isCreator: me.role === 'creator' },
    participants: people.map((p) => ({ id: p.id, name: p.displayName, finished: isFinished(p) })),
    kind,
    version,
    naming,
    result,
    items: Object.fromEntries(items),
    reactions: byItem,
    notForUs: [...new Set([...rejected, ...swappedAway])],
    shopping: shopping.map((s) => ({ itemId: s.itemId, source: s.source, bought: !!s.boughtAt })),
    total: await shoppingTotal(db, projectId),
    tiebreak: await tiebreakState(db, projectId, viewerParticipantId),
    feedback: fb ? fb.helpful : null,
    joinedLate: lateIds,
  };
}

export async function submitFeedback(
  db: Db,
  participantId: string,
  helpful: boolean,
): Promise<void> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  await db
    .insert(boardFeedback)
    .values({ projectId: me.projectId, participantId, helpful })
    .onConflictDoUpdate({
      target: [boardFeedback.projectId, boardFeedback.participantId],
      set: { helpful },
    });
}

export async function participantNames(db: Db, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.select().from(participant).where(inArray(participant.id, ids));
  return new Map(rows.map((r) => [r.id, r.displayName]));
}
