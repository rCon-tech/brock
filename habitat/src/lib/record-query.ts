import { sql, type SQL } from 'drizzle-orm';
import type { CollectionDef, Field } from '@/modules/sdk/types';

export class BadQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadQueryError';
  }
}

export const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'] as const;
export type Operator = (typeof OPERATORS)[number];

export interface QuerySpec {
  where?: Record<string, Partial<Record<Operator, string>>>;
  parentId?: string;
  authorId?: string;
  pinned?: boolean;
  /** `field:asc` or `field:desc`; `createdAt` is always allowed. Default `createdAt:desc`. */
  order?: string;
  limit?: number;
  cursor?: string;
}

type Cast = 'text' | 'bigint' | 'numeric' | 'boolean' | 'date' | 'timestamptz';
type Value = string | number | boolean;

export interface ParsedFilter {
  field: string;
  op: Operator;
  cast: Cast;
  value: Value | Value[];
}

export interface ParsedQuery {
  filters: ParsedFilter[];
  parentId?: string;
  authorId?: string;
  pinned?: boolean;
  order: { field: string; dir: 'asc' | 'desc'; cast: Cast | null };
  limit: number;
  cursor?: { value: Value; id: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_LIMIT = 100;

function castFor(f: Field): Cast {
  switch (f.type) {
    case 'integer':
      return 'bigint';
    case 'number':
      return 'numeric';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'timestamptz';
    case 'text':
    case 'longtext':
    case 'enum':
    case 'url':
    case 'member':
    case 'media':
      return 'text';
    default:
      throw new BadQueryError(`Cannot filter or sort on a "${f.type}" field`);
  }
}

function coerce(raw: string, cast: Cast, field: string): Value {
  switch (cast) {
    case 'bigint': {
      if (!/^-?\d{1,15}$/.test(raw)) throw new BadQueryError(`"${field}" expects an integer`);
      return Number(raw);
    }
    case 'numeric': {
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n))
        throw new BadQueryError(`"${field}" expects a number`);
      return n;
    }
    case 'boolean':
      if (raw !== 'true' && raw !== 'false')
        throw new BadQueryError(`"${field}" expects true or false`);
      return raw === 'true';
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
        throw new BadQueryError(`"${field}" expects YYYY-MM-DD`);
      return raw;
    case 'timestamptz': {
      if (Number.isNaN(Date.parse(raw)))
        throw new BadQueryError(`"${field}" expects an ISO date-time`);
      return new Date(raw).toISOString();
    }
    default:
      return raw;
  }
}

/** Validate a query against a collection's declared fields. Pure: no SQL, no DB. */
export function parseQuery(spec: QuerySpec, def: CollectionDef): ParsedQuery {
  const filters: ParsedFilter[] = [];
  for (const [field, ops] of Object.entries(spec.where ?? {})) {
    const f = def.fields[field];
    if (!f) throw new BadQueryError(`"${field}" is not a field of this collection`);
    const cast = castFor(f);
    for (const [op, raw] of Object.entries(ops ?? {})) {
      if (!(OPERATORS as readonly string[]).includes(op))
        throw new BadQueryError(`Unknown operator "${op}"`);
      if (typeof raw !== 'string') throw new BadQueryError(`"${field}.${op}" must be a string`);
      const value =
        op === 'in'
          ? raw
              .split(',')
              .slice(0, 100)
              .map((v) => coerce(v, cast, field))
          : coerce(raw, cast, field);
      filters.push({ field, op: op as Operator, cast, value });
    }
  }

  if (spec.parentId !== undefined && !UUID.test(spec.parentId))
    throw new BadQueryError('parentId must be a uuid');
  if (spec.authorId !== undefined && !UUID.test(spec.authorId))
    throw new BadQueryError('authorId must be a uuid');

  const [orderField = 'createdAt', dirRaw = 'desc'] = (spec.order ?? 'createdAt:desc').split(':');
  if (dirRaw !== 'asc' && dirRaw !== 'desc')
    throw new BadQueryError('Order direction must be asc or desc');
  let orderCast: Cast | null = null;
  if (orderField !== 'createdAt') {
    const f = def.fields[orderField];
    if (!f) throw new BadQueryError(`Cannot order by "${orderField}"`);
    orderCast = castFor(f);
  }

  const limit = Math.min(Math.max(Math.trunc(spec.limit ?? 20) || 20, 1), MAX_LIMIT);

  let cursor: ParsedQuery['cursor'];
  if (spec.cursor) {
    try {
      const [value, id] = JSON.parse(Buffer.from(spec.cursor, 'base64url').toString('utf8')) as [
        Value,
        string,
      ];
      if (!UUID.test(id) || !['string', 'number', 'boolean'].includes(typeof value))
        throw new Error();
      cursor = { value, id };
    } catch {
      throw new BadQueryError('Invalid cursor');
    }
  }

  return {
    filters,
    parentId: spec.parentId,
    authorId: spec.authorId,
    pinned: spec.pinned,
    order: { field: orderField, dir: dirRaw, cast: orderCast },
    limit,
    cursor,
  };
}

export function encodeCursor(value: Value, id: string): string {
  return Buffer.from(JSON.stringify([value, id])).toString('base64url');
}

function col(field: string, cast: Cast): SQL {
  // `field` was checked against the declared field names, which are [a-zA-Z0-9]; it is bound, not spliced.
  return sql`("record"."data"->>${field})::${sql.raw(cast)}`;
}

function bind(value: Value, cast: Cast): SQL {
  return sql`${value}::${sql.raw(cast)}`;
}

const SQL_OP: Record<Exclude<Operator, 'in'>, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

/** Turn a parsed query into WHERE conditions (all ANDed) and an ORDER BY. Every value is bound. */
export function toSql(q: ParsedQuery): { conditions: SQL[]; orderBy: SQL; sortExpr: SQL } {
  const conditions: SQL[] = [];
  for (const f of q.filters) {
    if (f.op === 'in') {
      const list = (f.value as Value[]).map((v) => bind(v, f.cast));
      conditions.push(
        list.length ? sql`${col(f.field, f.cast)} IN (${sql.join(list, sql`, `)})` : sql`false`,
      );
    } else {
      conditions.push(
        sql`${col(f.field, f.cast)} ${sql.raw(SQL_OP[f.op])} ${bind(f.value as Value, f.cast)}`,
      );
    }
  }
  if (q.parentId) conditions.push(sql`"record"."parent_id" = ${q.parentId}::uuid`);
  if (q.authorId) conditions.push(sql`"record"."author_id" = ${q.authorId}`);
  if (q.pinned === true) conditions.push(sql`"record"."pinned_at" IS NOT NULL`);
  if (q.pinned === false) conditions.push(sql`"record"."pinned_at" IS NULL`);

  const sortExpr = q.order.cast ? col(q.order.field, q.order.cast) : sql`"record"."created_at"`;
  const sortCast: Cast = q.order.cast ?? 'timestamptz';
  const dir = q.order.dir === 'asc' ? sql`ASC` : sql`DESC`;
  const cmp = q.order.dir === 'asc' ? sql`>` : sql`<`;

  if (q.cursor) {
    conditions.push(
      sql`(${sortExpr}, "record"."id") ${cmp} (${bind(q.cursor.value, sortCast)}, ${q.cursor.id}::uuid)`,
    );
  }
  return { conditions, orderBy: sql`${sortExpr} ${dir}, "record"."id" ${dir}`, sortExpr };
}
