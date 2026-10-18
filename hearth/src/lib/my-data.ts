import { eq, inArray } from 'drizzle-orm';
import { itemReaction, participant, project, swipe, user, veto } from '@/db/schema';
import type { Db } from '@/db';
import { computeSynthesis } from '@/lib/synthesis';

/** Everything held about a person, as plain JSON (R37, UK GDPR right of access). */
export async function exportMyData(db: Db, userId: string) {
  const [account] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      isAnonymous: user.isAnonymous,
    })
    .from(user)
    .where(eq(user.id, userId));
  const mine = await db.select().from(participant).where(eq(participant.hostUserId, userId));
  const ids = mine.map((p) => p.id);
  const projects = ids.length
    ? await db
        .select()
        .from(project)
        .where(inArray(project.id, [...new Set(mine.map((p) => p.projectId))]))
    : [];
  return {
    exportedAt: new Date().toISOString(),
    account,
    projects: projects.map((p) => ({
      id: p.id,
      roomType: p.roomType,
      name: p.name,
      budgetBand: p.budgetBand,
      context: p.context,
      createdAt: p.createdAt,
    })),
    participants: mine.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      displayName: p.displayName,
      joinedAt: p.joinedAt,
    })),
    swipes: ids.length
      ? await db.select().from(swipe).where(inArray(swipe.participantId, ids))
      : [],
    vetoes: ids.length ? await db.select().from(veto).where(inArray(veto.participantId, ids)) : [],
    reactions: ids.length
      ? await db.select().from(itemReaction).where(inArray(itemReaction.participantId, ids))
      : [],
  };
}

/**
 * Deletes a person and what they added. Rooms they started live on for the others if anyone
 * remains; boards that are already out are rebuilt without them (R37).
 */
export async function deleteMyData(db: Db, userId: string): Promise<void> {
  const mine = await db.select().from(participant).where(eq(participant.hostUserId, userId));
  const projectIds = [...new Set(mine.map((p) => p.projectId))];

  await db.delete(participant).where(eq(participant.hostUserId, userId));

  const affected: string[] = [];
  const created = await db.select().from(project).where(eq(project.createdBy, userId));
  for (const proj of created) {
    const remaining = await db.select().from(participant).where(eq(participant.projectId, proj.id));
    const heir = remaining.find((p) => p.userId)?.userId ?? remaining[0]?.hostUserId;
    if (!heir) {
      await db.delete(project).where(eq(project.id, proj.id));
    } else {
      await db.update(project).set({ createdBy: heir }).where(eq(project.id, proj.id));
      await db
        .update(participant)
        .set({ role: 'creator' })
        .where(eq(participant.id, remaining.find((p) => p.hostUserId === heir)!.id));
    }
  }
  for (const id of projectIds) {
    const [p] = await db.select().from(project).where(eq(project.id, id));
    if (p?.revealedAt) affected.push(id);
  }
  await db.delete(user).where(eq(user.id, userId));
  for (const id of affected) await computeSynthesis(db, id);
}
