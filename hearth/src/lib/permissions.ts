import { and, eq } from 'drizzle-orm';
import { participant, project } from '@/db/schema';
import type { Db } from '@/db';
import { AppError, Forbidden, NotFound } from '@/lib/errors';

export type ProjectRow = typeof project.$inferSelect;
export type ParticipantRow = typeof participant.$inferSelect;

export interface Access {
  project: ProjectRow;
  /** The participant acting. In pass-the-phone mode a session can control several people. */
  me: ParticipantRow;
  hosted: ParticipantRow[];
}

/**
 * Every project action starts here. Non-members get a 404, never a 403, so project ids can't be
 * probed. `participantId` picks who is acting when one phone controls several people (R17).
 */
export async function requireParticipant(
  db: Db,
  projectId: string,
  userId: string,
  participantId?: string,
): Promise<Access> {
  const hosted = await db
    .select()
    .from(participant)
    .where(and(eq(participant.projectId, projectId), eq(participant.hostUserId, userId)));
  if (hosted.length === 0) throw new NotFound();
  let me: ParticipantRow | undefined;
  if (participantId) {
    me = hosted.find((p) => p.id === participantId);
    if (!me) throw new NotFound();
  } else if (hosted.length === 1) {
    me = hosted[0];
  } else {
    throw new AppError('Choose who is swiping.');
  }
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  return { project: proj, me, hosted };
}

export async function requireCreator(db: Db, projectId: string, userId: string): Promise<Access> {
  const access = await requireParticipant(db, projectId, userId);
  if (access.project.createdBy !== userId)
    throw new Forbidden('Only the person who started this can do that.');
  return access;
}
