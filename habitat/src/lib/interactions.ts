import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { comment, membership, reaction, record, REACTIONS, user, type Reaction } from '@/db/schema';
import type { MemberDTO } from '@/modules/sdk/types';
import { DomainError, forbidden, invalid, notFound } from './errors';
import { extractMentions } from './mentions';
import { notify, type NewNotification } from './notifications';
import { can } from './permissions';
import { rateLimit } from './rate-limit';
import { WRITES_PER_MINUTE, loadVisibleRow } from './records';
import type { MemberCtx } from './session';

export const COMMENT_MAX = 2000;

export interface CommentDTO {
  id: string;
  recordId: string;
  parentCommentId: string | null;
  author: MemberDTO | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  replies: CommentDTO[];
}

function cleanBody(body: string) {
  const b = body.trim();
  if (!b) throw invalid('Write something first.', { body: ['Required.'] });
  if (b.length > COMMENT_MAX)
    throw invalid('That’s too long.', { body: [`At most ${COMMENT_MAX} characters.`] });
  return b;
}

export async function addComment(
  ctx: MemberCtx,
  recordId: string,
  input: { body: string; parentCommentId?: string | null },
  now = new Date(),
): Promise<CommentDTO> {
  const db = getDb();
  await rateLimit(`rw:${ctx.habitatId}:${ctx.userId}`, WRITES_PER_MINUTE, 60, now);
  const { row } = await loadVisibleRow(db, ctx, recordId);
  const body = cleanBody(input.body);

  const id = await db.transaction(async (tx) => {
    let parent: typeof comment.$inferSelect | undefined;
    if (input.parentCommentId) {
      [parent] = await tx
        .select()
        .from(comment)
        .where(
          and(
            eq(comment.id, input.parentCommentId),
            eq(comment.recordId, recordId),
            eq(comment.habitatId, ctx.habitatId),
            isNull(comment.deletedAt),
          ),
        );
      if (!parent) throw notFound();
      if (parent.parentCommentId) throw invalid('You can only reply to a top-level comment.'); // H12
    }
    const [c] = await tx
      .insert(comment)
      .values({
        habitatId: ctx.habitatId,
        recordId,
        parentCommentId: parent?.id ?? null,
        authorId: ctx.userId,
        body,
        createdAt: now,
      })
      .returning({ id: comment.id });

    const people = await tx
      .select({ userId: membership.userId, name: user.name, nickname: membership.nickname })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.habitatId, ctx.habitatId), isNull(membership.leftAt)));
    const me = people.find((p) => p.userId === ctx.userId);
    const author = me?.nickname || me?.name || 'Someone';
    const out = new Map<string, NewNotification>();
    const add = (userId: string | null | undefined, type: string) => {
      if (!userId || userId === ctx.userId || out.has(userId)) return;
      if (!people.some((p) => p.userId === userId)) return;
      out.set(userId, {
        userId,
        habitatId: ctx.habitatId,
        type,
        actorId: ctx.userId,
        recordId,
        payload: {
          text: `${author} ${type === 'comment.mention' ? 'mentioned you in a comment' : type === 'comment.reply' ? 'replied to your comment' : 'commented on your post'}`,
          moduleId: row.moduleId,
        },
      });
    };
    // Priority: a mention beats a reply beats a plain comment, and nobody is notified twice.
    for (const uid of extractMentions(
      body,
      people.map((p) => ({ userId: p.userId, names: [p.nickname ?? '', p.name] })),
    ))
      add(uid, 'comment.mention');
    add(parent?.authorId, 'comment.reply');
    add(row.authorId, 'comment.new');
    await notify(tx, [...out.values()]);
    return c!.id;
  });

  const all = await listComments(ctx, recordId);
  const flat = all.flatMap((c) => [c, ...c.replies]);
  return flat.find((c) => c.id === id)!;
}

export async function listComments(ctx: MemberCtx, recordId: string): Promise<CommentDTO[]> {
  const db = getDb();
  await loadVisibleRow(db, ctx, recordId);
  const rows = await db
    .select({
      c: comment,
      name: user.name,
      image: user.image,
      nickname: membership.nickname,
      leftAt: membership.leftAt,
    })
    .from(comment)
    .leftJoin(user, eq(user.id, comment.authorId))
    .leftJoin(
      membership,
      and(eq(membership.userId, comment.authorId), eq(membership.habitatId, ctx.habitatId)),
    )
    .where(
      and(
        eq(comment.recordId, recordId),
        eq(comment.habitatId, ctx.habitatId),
        isNull(comment.deletedAt),
      ),
    )
    .orderBy(asc(comment.createdAt), asc(comment.id));
  const dto = (r: (typeof rows)[number]): CommentDTO => ({
    id: r.c.id,
    recordId: r.c.recordId,
    parentCommentId: r.c.parentCommentId,
    author:
      r.c.authorId && !r.leftAt
        ? {
            id: r.c.authorId,
            name: r.name ?? 'Someone',
            image: r.image ?? null,
            nickname: r.nickname ?? null,
          }
        : r.c.authorId
          ? { id: r.c.authorId, name: 'Former member', image: null, nickname: null }
          : null,
    body: r.c.body,
    createdAt: r.c.createdAt.toISOString(),
    editedAt: r.c.editedAt?.toISOString() ?? null,
    replies: [],
  });
  const top = rows.filter((r) => !r.c.parentCommentId).map(dto);
  for (const r of rows.filter((x) => x.c.parentCommentId)) {
    top.find((t) => t.id === r.c.parentCommentId)?.replies.push(dto(r));
  }
  return top;
}

async function loadComment(ctx: MemberCtx, commentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw notFound();
  const [c] = await getDb()
    .select()
    .from(comment)
    .where(
      and(
        eq(comment.id, commentId),
        eq(comment.habitatId, ctx.habitatId),
        isNull(comment.deletedAt),
      ),
    );
  if (!c) throw notFound();
  return c;
}

export async function editComment(
  ctx: MemberCtx,
  commentId: string,
  body: string,
  now = new Date(),
) {
  const c = await loadComment(ctx, commentId);
  if (c.authorId !== ctx.userId) throw forbidden();
  await getDb()
    .update(comment)
    .set({ body: cleanBody(body), editedAt: now })
    .where(eq(comment.id, c.id));
}

/** Authors delete their own; admins can delete any (H12). Replies go with a deleted parent. */
export async function deleteComment(ctx: MemberCtx, commentId: string, now = new Date()) {
  const c = await loadComment(ctx, commentId);
  if (c.authorId !== ctx.userId && !can(ctx.role, 'content.moderate')) throw forbidden();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(comment).set({ deletedAt: now }).where(eq(comment.id, c.id));
    await tx
      .update(comment)
      .set({ deletedAt: now })
      .where(and(eq(comment.parentCommentId, c.id), isNull(comment.deletedAt)));
  });
}

function checkEmoji(emoji: string): Reaction {
  if (!(REACTIONS as readonly string[]).includes(emoji)) {
    throw invalid('Pick one of the reactions.', { emoji: [`One of ${REACTIONS.join(' ')}`] });
  }
  return emoji as Reaction;
}

export async function addReaction(ctx: MemberCtx, recordId: string, emoji: string) {
  const e = checkEmoji(emoji);
  const db = getDb();
  await loadVisibleRow(db, ctx, recordId);
  await db
    .insert(reaction)
    .values({ habitatId: ctx.habitatId, recordId, userId: ctx.userId, emoji: e })
    .onConflictDoNothing();
}

export async function removeReaction(ctx: MemberCtx, recordId: string, emoji: string) {
  const e = checkEmoji(emoji);
  const db = getDb();
  await loadVisibleRow(db, ctx, recordId);
  await db
    .delete(reaction)
    .where(
      and(eq(reaction.recordId, recordId), eq(reaction.userId, ctx.userId), eq(reaction.emoji, e)),
    );
}

/** Admins pin; only records that show in the timeline can be pinned. */
export async function setPinned(
  ctx: MemberCtx,
  recordId: string,
  pinned: boolean,
  now = new Date(),
) {
  if (!can(ctx.role, 'record.pin')) throw forbidden('Only admins can pin.');
  const db = getDb();
  const { def } = await loadVisibleRow(db, ctx, recordId);
  if (!def.showInTimeline)
    throw new DomainError('invalid', 422, 'Only timeline posts can be pinned.');
  await db
    .update(record)
    .set({ pinnedAt: pinned ? now : null })
    .where(and(eq(record.id, recordId), eq(record.habitatId, ctx.habitatId)));
}

export async function countComments(recordId: string) {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(comment)
    .where(and(eq(comment.recordId, recordId), isNull(comment.deletedAt)));
  return n;
}
