import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { BadQueryError, encodeCursor, parseQuery, toSql } from '@/lib/record-query';
import type { CollectionDef } from '@/modules/sdk/types';

const def: CollectionDef = {
  fields: {
    title: { type: 'text', max: 50 },
    startsAt: { type: 'datetime' },
    seats: { type: 'integer' },
    done: { type: 'boolean' },
    cost: { type: 'money' },
  },
};
const uuid = '8f14e45f-ceea-467a-9575-1f1a2a6e0a11';
const dialect = new PgDialect();
const render = (q: ReturnType<typeof parseQuery>) => {
  const { conditions, orderBy } = toSql(q);
  return dialect.sqlToQuery(sql`${sql.join([...conditions, sql`true`], sql` AND `)} ORDER BY ${orderBy}`);
};

describe('parseQuery', () => {
  it('defaults to newest first with limit 20', () => {
    const q = parseQuery({}, def);
    expect(q.order).toEqual({ field: 'createdAt', dir: 'desc', cast: null });
    expect(q.limit).toBe(20);
  });
  it('rejects undeclared fields', () => {
    expect(() => parseQuery({ where: { secret: { eq: 'x' } } }, def)).toThrow(BadQueryError);
    expect(() => parseQuery({ order: 'secret:asc' }, def)).toThrow(BadQueryError);
  });
  it('rejects unknown operators', () => {
    expect(() => parseQuery({ where: { title: { like: '%' } as never } }, def)).toThrow(/operator/);
  });
  it('rejects values of the wrong type', () => {
    expect(() => parseQuery({ where: { seats: { eq: '1; DROP TABLE record' } } }, def)).toThrow(BadQueryError);
    expect(() => parseQuery({ where: { startsAt: { gte: 'tomorrow' } } }, def)).toThrow(BadQueryError);
    expect(() => parseQuery({ where: { done: { eq: 'maybe' } } }, def)).toThrow(BadQueryError);
  });
  it('cannot filter or sort on a money field', () => {
    expect(() => parseQuery({ where: { cost: { eq: '1' } } }, def)).toThrow(BadQueryError);
  });
  it('validates ids, direction and cursors', () => {
    expect(() => parseQuery({ parentId: 'x' }, def)).toThrow();
    expect(() => parseQuery({ authorId: "x'; --" }, def)).toThrow();
    expect(() => parseQuery({ order: 'title:sideways' }, def)).toThrow();
    expect(() => parseQuery({ cursor: 'garbage' }, def)).toThrow(/cursor/);
  });
  it('clamps the limit to 1–100', () => {
    expect(parseQuery({ limit: 5000 }, def).limit).toBe(100);
    expect(parseQuery({ limit: -4 }, def).limit).toBe(1);
    expect(parseQuery({ limit: 0 }, def).limit).toBe(20);
  });
});

describe('toSql', () => {
  it('binds an injection-shaped text value as a parameter, never in the SQL text', () => {
    const evil = "x'); DROP TABLE record; --";
    const { sql: text, params } = render(parseQuery({ where: { title: { eq: evil } } }, def));
    expect(text).not.toContain('DROP');
    expect(params).toContain(evil);
  });
  it('binds the field name too', () => {
    const { sql: text, params } = render(parseQuery({ where: { title: { eq: 'a' } } }, def));
    expect(text).toContain("->>$");
    expect(params).toContain('title');
  });
  it('casts by field type', () => {
    const { sql: text } = render(
      parseQuery({ where: { startsAt: { gte: '2026-01-01T00:00:00Z' }, seats: { lt: '5' } } }, def),
    );
    expect(text).toContain('::timestamptz');
    expect(text).toContain('::bigint');
  });
  it('builds IN lists and keyset cursors', () => {
    const cursor = encodeCursor('2026-01-01T00:00:00.000Z', uuid);
    const { sql: text, params } = render(
      parseQuery({ where: { title: { in: 'a,b,c' } }, cursor, limit: 10 }, def),
    );
    expect(text).toContain('IN (');
    expect(text).toContain('("record"."created_at", "record"."id") <');
    expect(params).toEqual(expect.arrayContaining(['a', 'b', 'c', uuid]));
  });
  it('orders by a declared field ascending', () => {
    const { sql: text } = render(parseQuery({ order: 'startsAt:asc' }, def));
    expect(text).toMatch(/ORDER BY .*ASC/);
  });
});
