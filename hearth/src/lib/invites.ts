import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { participant, project, projectInvite, user } from '@/db/schema';
import type { Db } from '@/db';
import { decrypt, encrypt, randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { Conflict, NotFound } from '@/lib/errors';
import { newId } from '@/lib/ids';

export const MAX_PARTICIPANTS = 4;
const INVITE_DAYS = 14;

/** Creates an invite link token. Only its hash is stored. */
export async function createInvite(db: Db, projectId: string): Promise<string> {
  const token = randomToken();
  await db.insert(projectInvite).values({
    id: newId(),
    projectId,
    tokenHash: sha256(token),
    tokenEnc: encrypt(token, env.BETTER_AUTH_SECRET),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  return token;
}

/** Revokes every live invite and issues a fresh one. */
export async function regenerateInvite(db: Db, projectId: string): Promise<string> {
  await db
    .update(projectInvite)
    .set({ revokedAt: new Date() })
    .where(and(eq(projectInvite.projectId, projectId), isNull(projectInvite.revokedAt)));
  return createInvite(db, projectId);
}

export interface InviteInfo {
  projectId: string;
  roomType: string;
  projectName: string | null;
  creatorName: string;
  full: boolean;
}

/** What the join page shows before anyone has signed in. Null for unknown, expired or revoked. */
export async function inviteInfo(db: Db, token: string): Promise<InviteInfo | null> {
  const [row] = await db
    .select({
      projectId: projectInvite.projectId,
      roomType: project.roomType,
      projectName: project.name,
      createdBy: project.createdBy,
    })
    .from(projectInvite)
    .innerJoin(project, eq(project.id, projectInvite.projectId))
    .where(
      and(
        eq(projectInvite.tokenHash, sha256(token)),
        isNull(projectInvite.revokedAt),
        gt(projectInvite.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  const [creator] = await db
    .select({ displayName: participant.displayName })
    .from(participant)
    .where(and(eq(participant.projectId, row.projectId), eq(participant.role, 'creator')));
  const [{ n }] = await db
    .select({ n: count() })
    .from(participant)
    .where(eq(participant.projectId, row.projectId));
  return {
    projectId: row.projectId,
    roomType: row.roomType,
    projectName: row.projectName,
    creatorName: creator?.displayName ?? 'Someone',
    full: n >= MAX_PARTICIPANTS,
  };
}

/** Joins a project. Idempotent: someone who already joined gets their existing place back. */
export async function acceptInvite(
  db: Db,
  token: string,
  userId: string,
  displayName: string,
): Promise<{ projectId: string; participantId: string }> {
  const info = await inviteInfo(db, token);
  if (!info) throw new NotFound('This invite link has expired or been replaced.');

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(participant)
      .where(and(eq(participant.projectId, info.projectId), eq(participant.userId, userId)));
    if (existing) return { projectId: info.projectId, participantId: existing.id };

    const [{ n }] = await tx
      .select({ n: count() })
      .from(participant)
      .where(eq(participant.projectId, info.projectId));
    if (n >= MAX_PARTICIPANTS)
      throw new Conflict(`This room already has ${MAX_PARTICIPANTS} people.`);

    const [proj] = await tx.select().from(project).where(eq(project.id, info.projectId));
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId));
    if (!u) throw new NotFound();
    const id = newId();
    await tx.insert(participant).values({
      id,
      projectId: info.projectId,
      userId,
      hostUserId: userId,
      displayName: displayName.trim().slice(0, 40) || 'Guest',
      role: 'partner',
      joinedAfterReveal: !!proj.revealedAt,
    });
    return { projectId: info.projectId, participantId: id };
  });
}

/** The link the creator shares: the newest live invite, or a fresh one if none is left. */
export async function currentInviteToken(db: Db, projectId: string): Promise<string> {
  const live = await db
    .select()
    .from(projectInvite)
    .where(
      and(
        eq(projectInvite.projectId, projectId),
        isNull(projectInvite.revokedAt),
        gt(projectInvite.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(projectInvite.createdAt));
  for (const invite of live) {
    const token = invite.tokenEnc ? decrypt(invite.tokenEnc, env.BETTER_AUTH_SECRET) : null;
    if (token) return token;
  }
  return createInvite(db, projectId);
}
