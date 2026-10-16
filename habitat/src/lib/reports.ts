import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { comment, membership, report, user } from '@/db/schema';
import { forbidden, invalid, notFound } from './errors';
import { logAudit } from './audit';
import { can } from './permissions';
import { rateLimit } from './rate-limit';
import { loadVisibleRow } from './records';
import type { MemberCtx } from './session';

export async function createReport(
  ctx: MemberCtx,
  input: { targetType: 'record' | 'comment' | 'member'; targetId: string; reason: string },
) {
  const db = getDb();
  await rateLimit(`report:${ctx.userId}`, 10, 3600);
  const reason = input.reason.trim();
  if (!reason) throw invalid('Say what’s wrong.', { reason: ['Required.'] });

  // The target must exist in this Habitat and be visible to the reporter.
  if (input.targetType === 'record') await loadVisibleRow(db, ctx, input.targetId);
  else if (input.targetType === 'comment') {
    const [c] = await db
      .select({ id: comment.id })
      .from(comment)
      .where(and(eq(comment.id, input.targetId), eq(comment.habitatId, ctx.habitatId), isNull(comment.deletedAt)));
    if (!c) throw notFound();
  } else {
    const [m] = await db
      .select({ id: membership.userId })
      .from(membership)
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, input.targetId), isNull(membership.leftAt)));
    if (!m) throw notFound();
  }
  const [r] = await db
    .insert(report)
    .values({
      habitatId: ctx.habitatId,
      reporterId: ctx.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: reason.slice(0, 1000),
    })
    .returning({ id: report.id });
  return r!;
}

/** Only that Habitat's admins see its reports. */
export async function listReports(ctx: MemberCtx) {
  if (!can(ctx.role, 'report.view')) throw forbidden();
  return getDb()
    .select({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      reporter: user.name,
    })
    .from(report)
    .leftJoin(user, eq(user.id, report.reporterId))
    .where(eq(report.habitatId, ctx.habitatId))
    .orderBy(desc(report.createdAt))
    .limit(100);
}

export async function resolveReport(ctx: MemberCtx, reportId: string) {
  if (!can(ctx.role, 'report.view')) throw forbidden();
  const db = getDb();
  const [r] = await db
    .update(report)
    .set({ status: 'resolved', resolvedBy: ctx.userId })
    .where(and(eq(report.id, reportId), eq(report.habitatId, ctx.habitatId)))
    .returning({ id: report.id });
  if (!r) throw notFound();
  await logAudit(db, ctx.habitatId, ctx.userId, 'report.resolved', { reportId });
}
