import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { comment, membership, reaction, record, user } from '@/db/schema';
import { forbidden, invalid, notFound } from './errors';
import { logAudit } from './audit';
import { canRemoveMember, can, type Role } from './permissions';
import { reevaluateOpen } from './proposals';
import type { MemberCtx } from './session';

export interface MemberRow {
  userId: string;
  name: string;
  image: string | null;
  nickname: string | null;
  role: Role;
  joinedAt: string;
}

export async function listMembers(habitatId: string): Promise<MemberRow[]> {
  const rows = await getDb()
    .select({
      userId: membership.userId,
      name: user.name,
      image: user.image,
      nickname: membership.nickname,
      role: membership.role,
      joinedAt: membership.joinedAt,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(and(eq(membership.habitatId, habitatId), isNull(membership.leftAt)))
    .orderBy(asc(membership.joinedAt));
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function changeRole(ctx: MemberCtx, targetId: string, role: 'admin' | 'member') {
  if (!can(ctx.role, 'member.role')) throw forbidden('Only the owner can change roles.');
  await getDb().transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(membership)
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, targetId), isNull(membership.leftAt)));
    if (!target) throw notFound();
    if (target.role === 'owner') throw invalid('Hand over ownership first.');
    await tx
      .update(membership)
      .set({ role })
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, targetId)));
    await logAudit(tx, ctx.habitatId, ctx.userId, 'member.role', { targetId, role });
  });
}

export async function setNickname(ctx: MemberCtx, nickname: string | null) {
  await getDb()
    .update(membership)
    .set({ nickname })
    .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, ctx.userId)));
}

/**
 * Remove a member, or leave (when `targetId` is yourself). The membership row stays with `left_at`
 * set, so their content is credited to a "former member" (H13). With `deleteContent` it goes too.
 */
export async function removeMember(
  ctx: MemberCtx,
  targetId: string,
  opts: { deleteContent?: boolean } = {},
  now = new Date(),
) {
  await getDb().transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(membership)
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, targetId), isNull(membership.leftAt)))
      .for('update');
    if (!target) throw notFound();
    if (target.role === 'owner' && targetId === ctx.userId) {
      throw invalid('Hand over ownership to someone else before you leave.');
    }
    if (!canRemoveMember(ctx.role, ctx.userId, target.role, targetId)) throw forbidden();

    await tx
      .update(membership)
      .set({ leftAt: now })
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, targetId)));

    if (opts.deleteContent && targetId === ctx.userId) {
      await tx
        .update(record)
        .set({ deletedAt: now })
        .where(and(eq(record.habitatId, ctx.habitatId), eq(record.authorId, targetId), isNull(record.deletedAt)));
      await tx
        .update(comment)
        .set({ deletedAt: now })
        .where(and(eq(comment.habitatId, ctx.habitatId), eq(comment.authorId, targetId), isNull(comment.deletedAt)));
      await tx.delete(reaction).where(and(eq(reaction.habitatId, ctx.habitatId), eq(reaction.userId, targetId)));
    }
    await logAudit(tx, ctx.habitatId, ctx.userId, targetId === ctx.userId ? 'member.left' : 'member.removed', {
      targetId,
      deleteContent: !!opts.deleteContent,
    });
    // Fewer members means different thresholds for any vote in progress.
    await reevaluateOpen(tx, ctx.habitatId, now);
  });
}
