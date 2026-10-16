import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { getDb, type Executor } from '@/db';
import { habitat, membership, notification, user } from '@/db/schema';

export interface NewNotification {
  userId: string;
  habitatId: string;
  type: string;
  actorId?: string | null;
  recordId?: string | null;
  proposalId?: string | null;
  payload?: Record<string, unknown>;
}

/** Written inside the caller's transaction, so a notification exists iff the action committed. */
export async function notify(db: Executor, rows: NewNotification[]): Promise<void> {
  if (!rows.length) return;
  await db.insert(notification).values(
    rows.map((r) => ({
      userId: r.userId,
      habitatId: r.habitatId,
      type: r.type,
      actorId: r.actorId ?? null,
      recordId: r.recordId ?? null,
      proposalId: r.proposalId ?? null,
      payload: r.payload ?? {},
    })),
  );
}

export async function activeMemberIds(db: Executor, habitatId: string, except?: string): Promise<string[]> {
  const rows = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.habitatId, habitatId), isNull(membership.leftAt)));
  return rows.map((r) => r.userId).filter((id) => id !== except);
}

export interface NotificationDTO {
  id: string;
  type: string;
  habitat: { id: string; slug: string; name: string; emoji: string };
  actor: { id: string; name: string } | null;
  recordId: string | null;
  proposalId: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ items: NotificationDTO[]; nextCursor: string | null; unread: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const cursorDate = opts.cursor ? new Date(opts.cursor) : null;
  const rows = await db
    .select({
      n: notification,
      h: { id: habitat.id, slug: habitat.slug, name: habitat.name, emoji: habitat.emoji },
      actorName: user.name,
    })
    .from(notification)
    .innerJoin(habitat, eq(habitat.id, notification.habitatId))
    .leftJoin(user, eq(user.id, notification.actorId))
    .where(
      and(
        eq(notification.userId, userId),
        isNull(habitat.deletedAt),
        cursorDate && !Number.isNaN(cursorDate.getTime()) ? lt(notification.createdAt, cursorDate) : undefined,
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return {
    items: page.map(({ n, h, actorName }) => ({
      id: n.id,
      type: n.type,
      habitat: h,
      actor: n.actorId ? { id: n.actorId, name: actorName ?? 'Someone' } : null,
      recordId: n.recordId,
      proposalId: n.proposalId,
      payload: n.payload,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]!.n.createdAt.toISOString() : null,
    unread,
  };
}

export async function markRead(userId: string, ids: string[] | 'all'): Promise<void> {
  const db = getDb();
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        ids === 'all' ? undefined : inArray(notification.id, ids),
      ),
    );
}
