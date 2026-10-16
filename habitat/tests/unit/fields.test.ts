import { describe, expect, it } from 'vitest';
import { compileFields, referenceFields } from '@/modules/sdk/fields';
import type { FieldSpec } from '@/modules/sdk/types';

const uuid = '8f14e45f-ceea-467a-9575-1f1a2a6e0a11';

describe('compileFields', () => {
  const spec: FieldSpec = {
    title: { type: 'text', max: 10, required: true },
    note: { type: 'longtext', max: 50 },
    n: { type: 'integer', min: 1, max: 5 },
    x: { type: 'number' },
    done: { type: 'boolean' },
    on: { type: 'date' },
    at: { type: 'datetime' },
    kind: { type: 'enum', options: ['a', 'b'] },
    link: { type: 'url' },
    cover: { type: 'media' },
    pics: { type: 'media-list', max: 2 },
    who: { type: 'member' },
    crew: { type: 'member-list', max: 2 },
    tags: { type: 'text-list', maxItems: 2, maxLength: 5 },
    cost: { type: 'money' },
  };
  const schema = compileFields(spec);

  it('accepts a valid document and fills list/boolean defaults', () => {
    const r = schema.parse({ title: '  hi  ' });
    expect(r).toMatchObject({ title: 'hi', done: false, pics: [], crew: [], tags: [] });
  });
  it('requires required fields and trims text', () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ title: '   ' }).success).toBe(false);
  });
  it('enforces max, min and integer-ness', () => {
    expect(schema.safeParse({ title: 'x'.repeat(11) }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', n: 0 }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', n: 6 }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', n: 2.5 }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', x: Infinity }).success).toBe(false);
  });
  it('validates dates, datetimes and enums', () => {
    expect(schema.safeParse({ title: 'a', on: '2026-02-30x' }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', on: '2026-02-03' }).success).toBe(true);
    expect(schema.safeParse({ title: 'a', at: 'tomorrow' }).success).toBe(false);
    expect(schema.parse({ title: 'a', at: '2026-02-03T10:00:00+01:00' }).at).toBe('2026-02-03T09:00:00.000Z');
    expect(schema.safeParse({ title: 'a', kind: 'c' }).success).toBe(false);
  });
  it('allows only http(s) URLs', () => {
    expect(schema.safeParse({ title: 'a', link: 'https://x.dev/a' }).success).toBe(true);
    expect(schema.safeParse({ title: 'a', link: 'javascript:alert(1)' }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', link: 'not a url' }).success).toBe(false);
  });
  it('validates ids and list lengths', () => {
    expect(schema.safeParse({ title: 'a', cover: 'nope' }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', cover: uuid, who: uuid }).success).toBe(true);
    expect(schema.safeParse({ title: 'a', pics: [uuid, uuid, uuid] }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', crew: [uuid, uuid, uuid] }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', tags: ['ok', 'toolong'] }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', tags: ['', 'x'] }).success).toBe(false);
  });
  it('validates money as integer minor units', () => {
    expect(schema.safeParse({ title: 'a', cost: { amountMinor: 1250, currency: 'GBP' } }).success).toBe(true);
    expect(schema.safeParse({ title: 'a', cost: { amountMinor: 12.5, currency: 'GBP' } }).success).toBe(false);
    expect(schema.safeParse({ title: 'a', cost: { amountMinor: 5, currency: 'pounds' } }).success).toBe(false);
  });
  it('strips unknown keys', () => {
    expect(schema.parse({ title: 'a', evil: 1 })).not.toHaveProperty('evil');
  });
});

describe('referenceFields', () => {
  it('lists media and member fields', () => {
    expect(
      referenceFields({
        a: { type: 'media' },
        b: { type: 'media-list', max: 1 },
        c: { type: 'member' },
        d: { type: 'member-list' },
        e: { type: 'text', max: 1 },
      }),
    ).toEqual({ media: ['a', 'b'], members: ['c', 'd'] });
  });
});
