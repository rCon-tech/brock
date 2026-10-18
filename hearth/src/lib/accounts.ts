import { and, eq } from 'drizzle-orm';
import { participant, project } from '@/db/schema';
import type { Db } from '@/db';

/**
 * When a guest signs in with Google, everything they did as a guest moves to their real account
 * and nothing is lost (§3 R3). Better Auth calls this just before it deletes the guest.
 */
export async function mergeUserData(db: Db, fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) return;
  await db.transaction(async (tx) => {
    const mine = await tx.select().from(participant).where(eq(participant.hostUserId, fromUserId));
    for (const p of mine) {
      const [dupe] = await tx
        .select()
        .from(participant)
        .where(and(eq(participant.projectId, p.projectId), eq(participant.userId, toUserId)));
      if (dupe && p.userId === fromUserId) {
        // The real account is already in this room; keep that place, drop the guest's.
        await tx.delete(participant).where(eq(participant.id, p.id));
        continue;
      }
      await tx
        .update(participant)
        .set({
          hostUserId: toUserId,
          userId: p.userId === fromUserId ? toUserId : p.userId,
        })
        .where(eq(participant.id, p.id));
    }
    await tx.update(project).set({ createdBy: toUserId }).where(eq(project.createdBy, fromUserId));
  });
}
