import { eq } from 'drizzle-orm';
import { participant, project } from '@/db/schema';
import type { Db } from '@/db';
import { AppError, NotFound } from '@/lib/errors';
import { computeSynthesis, isFinished } from '@/lib/synthesis';

/** R31: how long a partner has to finish before you can look at a board built from your swipes alone. */
export const SOLO_AFTER_MS = Number(process.env.SOLO_AFTER_MS ?? 3 * 86_400_000);

type P = typeof participant.$inferSelect;
type Proj = typeof project.$inferSelect;

/** "I'm ready to see it." On one phone, everyone who has finished is marked ready together (R17). */
export async function markReady(db: Db, participantId: string): Promise<void> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  if (!isFinished(me)) throw new AppError('Finish swiping first.');
  const hosted = (
    await db.select().from(participant).where(eq(participant.projectId, me.projectId))
  ).filter((p) => p.hostUserId === me.hostUserId && isFinished(p) && !p.readyAt);
  const now = new Date();
  for (const p of hosted)
    await db.update(participant).set({ readyAt: now }).where(eq(participant.id, p.id));
}

/**
 * Reveals the board once everyone has finished and tapped Ready (R18), or when someone forces it
 * with at least two people finished (R10). A project needs two people before it can be revealed.
 */
export async function maybeReveal(
  db: Db,
  projectId: string,
  opts: { force?: boolean } = {},
): Promise<{ revealed: boolean; version?: number }> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  if (proj.revealedAt) return { revealed: true };
  const people = await db.select().from(participant).where(eq(participant.projectId, projectId));
  if (people.length < 2) return { revealed: false };
  const finished = people.filter(isFinished);
  const everyoneReady = people.every((p) => isFinished(p) && p.readyAt);
  if (!(everyoneReady || (opts.force && finished.length >= 2))) return { revealed: false };

  await db.update(project).set({ revealedAt: new Date() }).where(eq(project.id, projectId));
  const out = await computeSynthesis(db, projectId);
  return { revealed: true, version: out?.version };
}

/**
 * Called whenever someone finishes their deck. Before the reveal, one-phone groups are ready as
 * soon as everyone has finished. After it, a late joiner's swipes update the board (R31).
 */
export async function afterFinished(db: Db, projectId: string) {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  if (proj.revealedAt) return computeSynthesis(db, projectId);
  if (proj.mode === 'together_one_device') {
    const people = await db.select().from(participant).where(eq(participant.projectId, projectId));
    if (people.every(isFinished)) {
      const now = new Date();
      for (const p of people)
        await db.update(participant).set({ readyAt: now }).where(eq(participant.id, p.id));
    }
    return maybeReveal(db, projectId);
  }
  return null;
}

/** Whether `me` may see a board built from their swipes alone before the shared reveal (R31). */
export function soloBoardAllowed(proj: Proj, me: P, people: P[], now = Date.now()): boolean {
  if (proj.revealedAt || !isFinished(me)) return false;
  if (people.length === 1) return true;
  return now - me.joinedAt.getTime() >= SOLO_AFTER_MS;
}
