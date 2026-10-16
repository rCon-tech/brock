import { and, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { record } from '@/db/schema';
import type { RecordDTO } from '@/modules/sdk/types';
import { DomainError } from './errors';
import { listActive, type ActiveModule } from './installed-modules';
import { hiddenCollections, hiddenFilter, toDTOs } from './records';
import type { MemberCtx } from './session';

export const TIMELINE_PAGE = 20;

/** The (module, collection) pairs that show on the home timeline for these installed modules. */
export function timelinePairs(active: ActiveModule[]) {
  return active.flatMap((a) =>
    Object.entries(a.manifest.collections)
      .filter(([, d]) => d.showInTimeline)
      .map(([c]) => ({ module: a.manifest.id, collection: c })),
  );
}

/**
 * The Habitat's home timeline: every installed module's `showInTimeline` collections merged,
 * newest first, with pinned records returned separately for the first page (H10).
 */
export async function getTimeline(
  ctx: MemberCtx,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ pinned: RecordDTO[]; items: RecordDTO[]; nextCursor: string | null }> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? TIMELINE_PAGE, 1), 50);
  const active = await listActive(db, ctx.habitatId);
  const pairs = timelinePairs(active);
  if (!pairs.length) return { pinned: [], items: [], nextCursor: null };

  const inPairs = or(
    ...pairs.map((p) => and(eq(record.moduleId, p.module), eq(record.collection, p.collection))),
  )!;
  const hidden = hiddenFilter(
    ctx.userId,
    hiddenCollections(active.map((a) => a.manifest)).filter((h) =>
      pairs.some((p) => p.module === h.module && p.collection === h.collection),
    ),
  );
  const base = and(eq(record.habitatId, ctx.habitatId), isNull(record.deletedAt), inPairs, hidden);

  let cursorCond: SQL | undefined;
  if (opts.cursor) {
    try {
      const [ts, id] = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8')) as [
        string,
        string,
      ];
      if (Number.isNaN(Date.parse(ts)) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error();
      cursorCond = sql`("record"."created_at", "record"."id") < (${new Date(ts).toISOString()}::timestamptz, ${id}::uuid)`;
    } catch {
      throw new DomainError('bad_query', 400, 'Invalid cursor');
    }
  }

  const pinnedRows = opts.cursor
    ? []
    : await db
        .select()
        .from(record)
        .where(and(base, isNotNull(record.pinnedAt)))
        .orderBy(desc(record.pinnedAt))
        .limit(10);

  const rows = await db
    .select()
    .from(record)
    .where(and(base, isNull(record.pinnedAt), cursorCond))
    .orderBy(desc(record.createdAt), desc(record.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString('base64url')
      : null;

  const dtos = await toDTOs(db, ctx, [...pinnedRows, ...page]);
  return {
    pinned: dtos.slice(0, pinnedRows.length),
    items: dtos.slice(pinnedRows.length),
    nextCursor,
  };
}
