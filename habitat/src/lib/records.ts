import { and, eq, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { getDb, type Executor } from '@/db';
import { comment, media, membership, reaction, record, user } from '@/db/schema';
import { compileFields, referenceFields } from '@/modules/sdk/fields';
import type { CollectionDef, MemberDTO, ModuleManifest, RecordDTO } from '@/modules/sdk/types';
import {
  DomainError,
  conflict,
  forbidden,
  invalid,
  isUniqueViolation,
  notFound,
  tooMany,
} from './errors';
import { requireInstalled } from './installed-modules';
import { extractMentions } from './mentions';
import { activeMemberIds, notify, type NewNotification } from './notifications';
import { canWriteRecord } from './permissions';
import { rateLimit } from './rate-limit';
import { encodeCursor, parseQuery, toSql, BadQueryError, type QuerySpec } from './record-query';
import { publish } from './realtime';
import type { MemberCtx } from './session';

type RecordRow = typeof record.$inferSelect;

export const WRITES_PER_MINUTE = 60;

export interface RecordInput {
  module: string;
  collection: string;
  parentId?: string | null;
  data: Record<string, unknown>;
}

function badQuery(e: unknown): never {
  if (e instanceof BadQueryError) throw new DomainError('bad_query', 400, e.message);
  throw e;
}

async function resolveDef(db: Executor, habitatId: string, moduleId: string, collection: string) {
  const manifest = await requireInstalled(db, habitatId, moduleId);
  const def = manifest.collections[collection];
  if (!def) throw new DomainError('unknown_collection', 404, 'There’s no such collection.');
  return { manifest, def };
}

/** SQL excluding records the viewer must not see (wishlist claims on their own wishes). */
export function hiddenFilter(
  viewerId: string,
  hidden: Array<{ module: string; collection: string }>,
): SQL | undefined {
  if (!hidden.length) return undefined;
  const clauses = hidden.map(
    (
      h,
    ) => sql`("record"."module_id" = ${h.module} AND "record"."collection" = ${h.collection} AND EXISTS (
      select 1 from "record" "p" where "p"."id" = "record"."parent_id" and "p"."author_id" = ${viewerId}))`,
  );
  return sql`NOT (${sql.join(clauses, sql` OR `)})`;
}

export function hiddenCollections(manifests: ModuleManifest[]) {
  return manifests.flatMap((m) =>
    Object.entries(m.collections)
      .filter(([, d]) => d.permissions?.hiddenFrom === 'parent-author')
      .map(([c]) => ({ module: m.id, collection: c })),
  );
}

function stringsIn(def: CollectionDef, data: Record<string, unknown>): string {
  return Object.entries(def.fields)
    .filter(([, f]) => f.type === 'text' || f.type === 'longtext')
    .map(([k]) => data[k])
    .filter((v): v is string => typeof v === 'string')
    .join('\n');
}

async function checkReferences(
  db: Executor,
  habitatId: string,
  def: CollectionDef,
  data: Record<string, unknown>,
) {
  const refs = referenceFields(def.fields);
  const errors: Record<string, string[]> = {};

  const mediaIds = new Set<string>();
  for (const f of refs.media) {
    const v = data[f];
    for (const id of Array.isArray(v) ? v : v ? [v] : []) mediaIds.add(id as string);
  }
  if (mediaIds.size) {
    const found = await db
      .select({ id: media.id })
      .from(media)
      .where(
        and(
          eq(media.habitatId, habitatId),
          inArray(media.id, [...mediaIds]),
          eq(media.status, 'ready'),
        ),
      );
    const ok = new Set(found.map((f) => f.id));
    for (const f of refs.media) {
      const v = data[f];
      if ((Array.isArray(v) ? v : v ? [v] : []).some((id) => !ok.has(id as string))) {
        errors[f] = ['That photo isn’t available in this Habitat.'];
      }
    }
  }

  const memberIds = new Set<string>();
  for (const f of refs.members) {
    const v = data[f];
    for (const id of Array.isArray(v) ? v : v ? [v] : []) memberIds.add(id as string);
  }
  if (memberIds.size) {
    const found = await db
      .select({ id: membership.userId })
      .from(membership)
      .where(
        and(
          eq(membership.habitatId, habitatId),
          inArray(membership.userId, [...memberIds]),
          isNull(membership.leftAt),
        ),
      );
    const ok = new Set(found.map((f) => f.id));
    for (const f of refs.members) {
      const v = data[f];
      if ((Array.isArray(v) ? v : v ? [v] : []).some((id) => !ok.has(id as string))) {
        errors[f] = ['That person isn’t a member of this Habitat.'];
      }
    }
  }
  if (Object.keys(errors).length) throw invalid('Some references are not valid.', errors);
}

function isEmptyValue(v: unknown) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function validateData(def: CollectionDef, raw: unknown): Record<string, unknown> {
  const parsed = compileFields(def.fields).safeParse(raw ?? {});
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_');
      (fields[key] ??= []).push(issue.message);
    }
    throw invalid('Some fields are not valid.', fields);
  }
  const data = parsed.data as Record<string, unknown>;
  if (def.atLeastOne && def.atLeastOne.every((f) => isEmptyValue(data[f]))) {
    throw invalid('Add some text or a photo.', {
      [def.atLeastOne[0]!]: ['Add some text or a photo.'],
    });
  }
  return data;
}

function uniqueKeyFor(def: CollectionDef, userId: string, parentId: string | null): string | null {
  switch (def.unique) {
    case 'per-member':
      return `u:${userId}`;
    case 'per-parent':
      return `p:${parentId}`;
    case 'per-member-per-parent':
      return `${parentId}:${userId}`;
    default:
      return null;
  }
}

async function memberNames(db: Executor, habitatId: string) {
  return db
    .select({ userId: membership.userId, name: user.name, nickname: membership.nickname })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(and(eq(membership.habitatId, habitatId), isNull(membership.leftAt)));
}

function fillTemplate(text: string, author: string, data: Record<string, unknown>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) =>
    k === 'author'
      ? author
      : typeof data[k] === 'string' || typeof data[k] === 'number'
        ? String(data[k])
        : '',
  );
}

export async function createRecord(
  ctx: MemberCtx,
  input: RecordInput,
  now = new Date(),
): Promise<RecordDTO> {
  const db = getDb();
  const { manifest, def } = await resolveDef(db, ctx.habitatId, input.module, input.collection);
  if (!canWriteRecord({ userId: ctx.userId, role: ctx.role }, def, 'create')) throw forbidden();
  await rateLimit(`rw:${ctx.habitatId}:${ctx.userId}`, WRITES_PER_MINUTE, 60, now);

  const parentId = input.parentId ?? null;
  if (def.parent && !parentId) throw invalid('This needs a parent.', { parentId: ['Required.'] });
  if (!def.parent && parentId)
    throw invalid('This can’t have a parent.', { parentId: ['Not allowed.'] });

  const data = validateData(def, input.data);

  const id = await db.transaction(async (tx) => {
    let parent: RecordRow | undefined;
    if (def.parent) {
      [parent] = await tx
        .select()
        .from(record)
        .where(
          and(
            eq(record.id, parentId!),
            eq(record.habitatId, ctx.habitatId),
            eq(record.moduleId, manifest.id),
            eq(record.collection, def.parent),
            isNull(record.deletedAt),
          ),
        );
      if (!parent) throw invalid('That parent doesn’t exist.', { parentId: ['Not found.'] });
      const lockAt = def.lockedAfterParentField
        ? parent.data[def.lockedAfterParentField]
        : undefined;
      if (typeof lockAt === 'string' && Date.parse(lockAt) <= now.getTime()) {
        throw conflict('closed', 'This has closed.');
      }
    }
    await checkReferences(tx, ctx.habitatId, def, data);

    if (def.limits?.perMemberPerDay) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(record)
        .where(
          and(
            eq(record.habitatId, ctx.habitatId),
            eq(record.moduleId, manifest.id),
            eq(record.collection, input.collection),
            eq(record.authorId, ctx.userId),
            isNull(record.deletedAt),
            gt(record.createdAt, new Date(now.getTime() - 86400_000)),
          ),
        );
      if (n >= def.limits.perMemberPerDay) throw tooMany('You’ve hit today’s limit for this.');
    }
    if (def.limits?.maxPerHabitat) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(record)
        .where(
          and(
            eq(record.habitatId, ctx.habitatId),
            eq(record.moduleId, manifest.id),
            eq(record.collection, input.collection),
            isNull(record.deletedAt),
          ),
        );
      if (n >= def.limits.maxPerHabitat)
        throw conflict('limit_reached', 'This Habitat has reached the limit.');
    }

    const uniqueKey = uniqueKeyFor(def, ctx.userId, parentId);
    const values = {
      habitatId: ctx.habitatId,
      moduleId: manifest.id,
      collection: input.collection,
      authorId: ctx.userId,
      parentId,
      data,
      uniqueKey,
      createdAt: now,
      updatedAt: now,
    };

    let inserted = true;
    let rowId: string;
    if (uniqueKey && def.unique !== 'per-parent') {
      // Same member answering again (an RSVP, a re-vote) updates their record instead of failing.
      const [r] = await tx
        .insert(record)
        .values(values)
        .onConflictDoUpdate({
          target: [record.habitatId, record.moduleId, record.collection, record.uniqueKey],
          targetWhere: sql`${record.uniqueKey} IS NOT NULL AND ${record.deletedAt} IS NULL`,
          set: { data, updatedAt: now },
        })
        .returning({ id: record.id, inserted: sql<boolean>`(xmax = 0)` });
      rowId = r!.id;
      inserted = r!.inserted;
    } else {
      try {
        const [r] = await tx.insert(record).values(values).returning({ id: record.id });
        rowId = r!.id;
      } catch (e) {
        if (isUniqueViolation(e)) throw conflict('already_exists', 'That’s already been done.');
        throw e;
      }
    }

    if (inserted && def.notify?.length) {
      const people = await memberNames(tx, ctx.habitatId);
      const me = people.find((p) => p.userId === ctx.userId);
      const author = me?.nickname || me?.name || 'Someone';
      const out = new Map<string, NewNotification>();
      for (const rule of def.notify) {
        let to: string[] = [];
        if (rule.to === 'all-members') to = await activeMemberIds(tx, ctx.habitatId, ctx.userId);
        else if (rule.to === 'parent-author') to = parent?.authorId ? [parent.authorId] : [];
        else
          to = extractMentions(
            stringsIn(def, data),
            people.map((p) => ({ userId: p.userId, names: [p.nickname ?? '', p.name] })),
          );
        for (const userId of to) {
          if (userId === ctx.userId || out.has(userId)) continue;
          out.set(userId, {
            userId,
            habitatId: ctx.habitatId,
            type: `${manifest.id}.${input.collection}`,
            actorId: ctx.userId,
            recordId: parent && rule.to === 'parent-author' ? parent.id : rowId,
            payload: {
              text: fillTemplate(rule.text, author, {
                ...(parent?.data ?? {}),
                ...data,
              }),
              moduleId: manifest.id,
            },
          });
        }
      }
      await notify(tx, [...out.values()]);
    }
    return rowId;
  });

  if (def.realtime) {
    await publish(ctx.habitatId, {
      type: 'record.created',
      moduleId: manifest.id,
      collection: input.collection,
      id,
    });
  }
  return getRecord(ctx, id);
}

/** A live, visible record row in this Habitat, or 404. */
export async function loadVisibleRow(
  db: Executor,
  ctx: MemberCtx,
  id: string,
): Promise<{ row: RecordRow; manifest: ModuleManifest; def: CollectionDef }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [row] = await db
    .select()
    .from(record)
    .where(and(eq(record.id, id), eq(record.habitatId, ctx.habitatId), isNull(record.deletedAt)));
  if (!row) throw notFound();
  const { manifest, def } = await resolveDef(db, ctx.habitatId, row.moduleId, row.collection).catch(
    () => {
      throw notFound();
    },
  );
  if (def.permissions?.hiddenFrom === 'parent-author' && row.parentId) {
    const [p] = await db
      .select({ authorId: record.authorId })
      .from(record)
      .where(eq(record.id, row.parentId));
    if (p?.authorId === ctx.userId) throw notFound();
  }
  return { row, manifest, def };
}

export async function getRecord(ctx: MemberCtx, id: string): Promise<RecordDTO> {
  const db = getDb();
  const { row } = await loadVisibleRow(db, ctx, id);
  return (await toDTOs(db, ctx, [row]))[0]!;
}

export async function queryRecords(
  ctx: MemberCtx,
  input: QuerySpec & { module: string; collection: string },
): Promise<{ items: RecordDTO[]; nextCursor: string | null }> {
  const db = getDb();
  const { manifest, def } = await resolveDef(db, ctx.habitatId, input.module, input.collection);
  let parsed;
  try {
    parsed = parseQuery(input, def);
  } catch (e) {
    badQuery(e);
  }
  const { conditions, orderBy } = toSql(parsed);
  const hidden = def.permissions?.hiddenFrom
    ? hiddenFilter(ctx.userId, [{ module: manifest.id, collection: input.collection }])
    : undefined;
  const rows = await db
    .select()
    .from(record)
    .where(
      and(
        eq(record.habitatId, ctx.habitatId),
        eq(record.moduleId, manifest.id),
        eq(record.collection, input.collection),
        isNull(record.deletedAt),
        hidden,
        ...conditions,
      ),
    )
    .orderBy(orderBy)
    .limit(parsed.limit + 1);
  const page = rows.slice(0, parsed.limit);
  let nextCursor: string | null = null;
  if (rows.length > parsed.limit) {
    const last = page[page.length - 1]!;
    const sortValue =
      parsed.order.field === 'createdAt'
        ? last.createdAt.toISOString()
        : (last.data[parsed.order.field] as string | number | boolean);
    nextCursor = encodeCursor(sortValue, last.id);
  }
  return { items: await toDTOs(db, ctx, page), nextCursor };
}

export async function updateRecord(
  ctx: MemberCtx,
  id: string,
  patch: Record<string, unknown>,
  now = new Date(),
): Promise<RecordDTO> {
  const db = getDb();
  await rateLimit(`rw:${ctx.habitatId}:${ctx.userId}`, WRITES_PER_MINUTE, 60, now);
  const { row, manifest, def } = await loadVisibleRow(db, ctx, id);
  if (
    !canWriteRecord(
      { userId: ctx.userId, role: ctx.role, recordAuthorId: row.authorId },
      def,
      'update',
    )
  ) {
    throw forbidden();
  }
  const data = validateData(def, { ...row.data, ...patch });
  await db.transaction(async (tx) => {
    await checkReferences(tx, ctx.habitatId, def, data);
    await tx.update(record).set({ data, updatedAt: now }).where(eq(record.id, id));
  });
  if (def.realtime) {
    await publish(ctx.habitatId, {
      type: 'record.updated',
      moduleId: manifest.id,
      collection: row.collection,
      id,
    });
  }
  return getRecord(ctx, id);
}

/** Soft delete, children included. */
export async function deleteRecord(ctx: MemberCtx, id: string, now = new Date()): Promise<void> {
  const db = getDb();
  const { row, manifest, def } = await loadVisibleRow(db, ctx, id);
  if (
    !canWriteRecord(
      { userId: ctx.userId, role: ctx.role, recordAuthorId: row.authorId },
      def,
      'delete',
    )
  ) {
    throw forbidden();
  }
  await db.transaction(async (tx) => {
    await tx
      .update(record)
      .set({ deletedAt: now })
      .where(and(eq(record.id, id), isNull(record.deletedAt)));
    await tx
      .update(record)
      .set({ deletedAt: now })
      .where(and(eq(record.parentId, id), isNull(record.deletedAt)));
    await tx
      .update(comment)
      .set({ deletedAt: now })
      .where(and(eq(comment.recordId, id), isNull(comment.deletedAt)));
  });
  if (def.realtime) {
    await publish(ctx.habitatId, {
      type: 'record.deleted',
      moduleId: manifest.id,
      collection: row.collection,
      id,
    });
  }
}

/** Authors, reactions and comment counts for a page of records, in four queries. */
export async function toDTOs(
  db: Executor,
  ctx: MemberCtx,
  rows: RecordRow[],
): Promise<RecordDTO[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId).filter((x): x is string => !!x))];

  const authors = authorIds.length
    ? await db
        .select({
          id: user.id,
          name: user.name,
          image: user.image,
          nickname: membership.nickname,
          leftAt: membership.leftAt,
        })
        .from(user)
        .leftJoin(
          membership,
          and(eq(membership.userId, user.id), eq(membership.habitatId, ctx.habitatId)),
        )
        .where(inArray(user.id, authorIds))
    : [];
  const authorMap = new Map<string, MemberDTO>(
    authors.map((a) => [
      a.id,
      a.leftAt
        ? { id: a.id, name: 'Former member', image: null, nickname: null }
        : { id: a.id, name: a.name, image: a.image, nickname: a.nickname },
    ]),
  );

  const reactions = await db
    .select({ recordId: reaction.recordId, emoji: reaction.emoji, userId: reaction.userId })
    .from(reaction)
    .where(inArray(reaction.recordId, ids));
  const comments = await db
    .select({ recordId: comment.recordId, n: sql<number>`count(*)::int` })
    .from(comment)
    .where(and(inArray(comment.recordId, ids), isNull(comment.deletedAt)))
    .groupBy(comment.recordId);

  return rows.map((r) => {
    const mine = reactions.filter((x) => x.recordId === r.id);
    const counts: Record<string, number> = {};
    for (const x of mine) counts[x.emoji] = (counts[x.emoji] ?? 0) + 1;
    return {
      id: r.id,
      module: r.moduleId,
      collection: r.collection,
      parentId: r.parentId,
      author: r.authorId ? (authorMap.get(r.authorId) ?? null) : null,
      data: r.data,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      pinned: !!r.pinnedAt,
      reactionCounts: counts,
      myReactions: mine.filter((x) => x.userId === ctx.userId).map((x) => x.emoji),
      commentCount: comments.find((c) => c.recordId === r.id)?.n ?? 0,
    };
  });
}
