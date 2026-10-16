import { describe, expect, it } from 'vitest';
import { parseManifest } from '@/modules/sdk/manifest-schema';

const good = {
  id: 'polls',
  name: 'Polls',
  tagline: 'Settle it',
  description: 'Vote on things',
  icon: 'bar-chart-3',
  category: 'fun',
  version: 1,
  collections: {
    poll: { fields: { question: { type: 'text', max: 200, required: true } } },
    vote: {
      parent: 'poll',
      unique: 'per-member-per-parent',
      fields: { choices: { type: 'text-list', maxItems: 5, maxLength: 50 } },
    },
  },
};

describe('parseManifest', () => {
  it('accepts a valid manifest', () => {
    expect(parseManifest(good).id).toBe('polls');
  });
  it('names the bad path', () => {
    expect(() => parseManifest({ ...good, category: 'nope' })).toThrow(/category/);
  });
  it('rejects a missing parent collection', () => {
    const bad = structuredClone(good);
    (bad.collections.vote as { parent?: string }).parent = 'ghost';
    expect(() => parseManifest(bad)).toThrow(/collections\.vote\.parent.*ghost/);
  });
  it('rejects per-parent uniqueness without a parent', () => {
    const bad = structuredClone(good);
    delete (bad.collections.vote as { parent?: string }).parent;
    expect(() => parseManifest(bad)).toThrow(/needs a parent/);
  });
  it('rejects bad ids and field names', () => {
    expect(() => parseManifest({ ...good, id: 'Bad Id' })).toThrow();
    const bad = structuredClone(good) as unknown as { collections: Record<string, unknown> };
    bad.collections.poll = { fields: { 'bad name': { type: 'text', max: 1 } } };
    expect(() => parseManifest(bad)).toThrow();
  });
  it('rejects unknown field types', () => {
    const bad = structuredClone(good) as unknown as { collections: Record<string, unknown> };
    bad.collections.poll = { fields: { x: { type: 'html' } } };
    expect(() => parseManifest(bad)).toThrow();
  });
  it('accepts custom module ids', () => {
    expect(parseManifest({ ...good, id: 'custom:8f14e45f-ceea-467a-9575-1f1a2a6e0a11' }).id).toMatch(/^custom:/);
  });
});

describe('lockedAfterParentField', () => {
  it('must name a datetime field on the parent', () => {
    const bad = structuredClone(good) as unknown as { collections: Record<string, Record<string, unknown>> };
    bad.collections.vote!.lockedAfterParentField = 'question';
    expect(() => parseManifest(bad)).toThrow(/datetime field on the parent/);
  });
});
