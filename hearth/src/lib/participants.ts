import { and, count, eq } from 'drizzle-orm';
import { participant, project } from '@/db/schema';
import type { Db } from '@/db';
import { AppError, Conflict, Forbidden, NotFound } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { MAX_PARTICIPANTS } from '@/lib/invites';
import { computeSynthesis, isFinished } from '@/lib/synthesis';

/** Someone sharing this phone (R17). They have no account until they sign in. */
export async function addDeviceParticipant(
  db: Db,
  hostUserId: string,
  projectId: string,
  displayName: string,
): Promise<string> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  if (proj.mode !== 'together_one_device')
    throw new AppError('This room is not set up for sharing one phone.');
  const [host] = await db
    .select()
    .from(participant)
    .where(and(eq(participant.projectId, projectId), eq(participant.hostUserId, hostUserId)));
  if (!host) throw new NotFound();
  const [{ n }] = await db
    .select({ n: count() })
    .from(participant)
    .where(eq(participant.projectId, projectId));
  if (n >= MAX_PARTICIPANTS)
    throw new Conflict(`This room already has ${MAX_PARTICIPANTS} people.`);
  const id = newId();
  await db.insert(participant).values({
    id,
    projectId,
    userId: null,
    hostUserId,
    displayName: displayName.trim().slice(0, 40) || 'Guest',
    role: 'partner',
    joinedAfterReveal: !!proj.revealedAt,
  });
  return id;
}

/**
 * The creator can remove anyone else; anyone can leave (R31). Their swipes, vetoes and reactions
 * go with them and, if the board is out, it is rebuilt for the people who remain.
 */
export async function removeParticipant(
  db: Db,
  actorUserId: string,
  projectId: string,
  participantId: string,
): Promise<void> {
  const [target] = await db
    .select()
    .from(participant)
    .where(and(eq(participant.id, participantId), eq(participant.projectId, projectId)));
  if (!target) throw new NotFound();
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  const isCreator = proj.createdBy === actorUserId;
  const isSelf = target.hostUserId === actorUserId;
  if (!isCreator && !isSelf) throw new NotFound();
  if (target.role === 'creator')
    throw new Forbidden('The person who started the room can’t leave it. Delete the room instead.');

  await db.delete(participant).where(eq(participant.id, participantId));
  if (proj.revealedAt) await computeSynthesis(db, projectId);
}

/** Wording for the "remind them" share sheet (R31). */
export function reminderText(opts: { fromName: string; roomLabel: string }): string {
  return `${opts.fromName} is waiting on you for the ${opts.roomLabel.toLowerCase()}. It takes about 3 minutes.`;
}

export function isStalled(p: { macroDoneAt: Date | null; microDoneAt: Date | null }): boolean {
  return !isFinished(p);
}
