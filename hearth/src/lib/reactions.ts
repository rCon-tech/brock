import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { itemReaction, participant, shoppingListItem } from '@/db/schema';
import type { Db } from '@/db';
import { AppError, NotFound } from '@/lib/errors';
import { latestSynthesis, isFinished } from '@/lib/synthesis';

export const NOTE_MAX = 140;
export const reactionInput = z.object({
  reaction: z.enum(['love', 'unsure', 'no']).nullable(),
  note: z.string().trim().max(NOTE_MAX).optional(),
});

/** Every item currently on the board, which is what people may react to. */
export function boardItemIds(result: {
  picks: { itemId: string }[];
  exactMicro: string[];
  exactMacro: string[];
  hybridRooms: string[];
}): Set<string> {
  return new Set([
    ...result.picks.map((p) => p.itemId),
    ...result.exactMicro,
    ...result.exactMacro,
    ...result.hybridRooms,
  ]);
}

/**
 * ❤️ / 🤔 / ✕ plus a short note (R29). If everyone who has finished loves an item it joins the
 * shopping list; a ✕ takes it off again. Reactions only change the board at the next recompute.
 */
export async function react(
  db: Db,
  participantId: string,
  itemId: string,
  rawInput: z.input<typeof reactionInput>,
): Promise<void> {
  const input = reactionInput.parse(rawInput);
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  const latest = await latestSynthesis(db, me.projectId);
  if (!latest) throw new AppError('The board is not ready yet.');
  if (!boardItemIds(latest.result).has(itemId)) throw new AppError("That item isn't on the board.");

  if (input.reaction === null) {
    await db
      .delete(itemReaction)
      .where(
        and(
          eq(itemReaction.projectId, me.projectId),
          eq(itemReaction.itemId, itemId),
          eq(itemReaction.participantId, participantId),
        ),
      );
  } else {
    await db
      .insert(itemReaction)
      .values({
        projectId: me.projectId,
        itemId,
        participantId,
        reaction: input.reaction,
        note: input.note || null,
      })
      .onConflictDoUpdate({
        target: [itemReaction.projectId, itemReaction.itemId, itemReaction.participantId],
        set: { reaction: input.reaction, note: input.note || null, updatedAt: new Date() },
      });
  }

  const people = (
    await db.select().from(participant).where(eq(participant.projectId, me.projectId))
  ).filter(isFinished);
  const reactions = await db
    .select()
    .from(itemReaction)
    .where(and(eq(itemReaction.projectId, me.projectId), eq(itemReaction.itemId, itemId)));
  const everyoneLoves =
    people.length > 0 &&
    people.every((p) => reactions.some((r) => r.participantId === p.id && r.reaction === 'love'));
  const anyNo = reactions.some((r) => r.reaction === 'no');

  if (everyoneLoves) {
    await db
      .insert(shoppingListItem)
      .values({ projectId: me.projectId, itemId, source: 'loved' })
      .onConflictDoNothing();
  } else if (anyNo) {
    await db
      .delete(shoppingListItem)
      .where(
        and(
          eq(shoppingListItem.projectId, me.projectId),
          eq(shoppingListItem.itemId, itemId),
          eq(shoppingListItem.source, 'loved'),
        ),
      );
  }
}
