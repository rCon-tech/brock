import { describe, expect, it } from 'vitest';
import bucketList from '@/modules/bucket-list/module.json';
import { parseMdl } from '@/modules/declarative/mdl-schema';
import { defaultModuleIds, getManifest, listLibrary } from '@/modules/registry';

// Tests poke at arbitrary places in the document, so they work on loosely typed JSON.
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = (x: unknown): Json => structuredClone(x);

describe('bucket-list/module.json', () => {
  it('is a valid MDL document', () => {
    expect(parseMdl(bucketList).manifest.id).toBe('bucket-list');
  });
});

describe('MDL validation', () => {
  it('rejects a view that names an unknown collection, with the path', () => {
    const bad = clone(bucketList);
    bad.views.main.children[1].collection = 'ghost';
    expect(() => parseMdl(bad)).toThrow(
      /views\.main\.children\.1\.collection: Unknown collection "ghost"/,
    );
  });

  it('rejects unknown fields in filters, forms and cells', () => {
    const a = clone(bucketList);
    a.views.main.children[0].filter.field = 'nope';
    expect(() => parseMdl(a)).toThrow(/not a field/);
    const b = clone(bucketList);
    b.views.main.children[1].fields = ['title', 'nope'];
    expect(() => parseMdl(b)).toThrow(/fields\.1/);
    const c = clone(bucketList);
    c.views.main.children[2].tabs[0].view.cells[1].field = 'nope';
    expect(() => parseMdl(c)).toThrow(/cells\.1\.field/);
  });

  it('checks that cell styles suit the field type', () => {
    const bad = clone(bucketList);
    bad.views.main.children[2].tabs[0].view.cells[1].as = 'toggle'; // title is text, not yes/no
    expect(() => parseMdl(bad)).toThrow(/toggle needs a yes\/no field/);
  });

  it('rejects unknown block types, HTML-ish extras and script-like values', () => {
    const a = clone(bucketList);
    a.views.main.children.push({ type: 'html', html: '<script>alert(1)</script>' });
    expect(() => parseMdl(a)).toThrow();
    const b = clone(bucketList);
    b.views.main.children.push({ type: 'text', text: 'x'.repeat(501) });
    expect(() => parseMdl(b)).toThrow();
  });

  it('limits nesting depth', () => {
    const deep = (n: number): unknown =>
      n === 0 ? { type: 'text', text: 'x' } : { type: 'stack', children: [deep(n - 1)] };
    const doc = clone(bucketList);
    doc.views.main = deep(6);
    expect(() => parseMdl(doc)).toThrow(/at most 4 levels/);
  });

  it('rejects forms for child collections and missing manifests', () => {
    expect(() => parseMdl({ views: { main: { type: 'text', text: 'hi' } } })).toThrow(/manifest/);
    expect(() => parseMdl(null)).toThrow();
  });

  it('rejects filters on photo or list fields', () => {
    const bad = clone(bucketList);
    bad.manifest.collections.idea.fields.photos = { type: 'media-list', max: 3 };
    bad.views.main.children[0].filter = { field: 'photos', op: 'eq', value: 'x' };
    expect(() => parseMdl(bad)).toThrow(/Cannot filter/);
  });
});

describe('the module registry', () => {
  it('contains every built-in and the declarative Bucket List', () => {
    expect(
      listLibrary()
        .map((m) => m.id)
        .sort(),
    ).toEqual(
      [
        'birthdays',
        'bucket-list',
        'chat',
        'events',
        'feed',
        'photos',
        'polls',
        'recommendations',
        'split-costs',
        'wishlist',
      ].sort(),
    );
  });
  it('starts Habitats with Feed, Photos, Events and Chat (H5)', () => {
    expect(defaultModuleIds().sort()).toEqual(['chat', 'events', 'feed', 'photos']);
  });
  it('every collection has valid parents and every nav label is set', () => {
    for (const m of listLibrary()) {
      for (const c of Object.values(m.collections))
        if (c.parent) expect(m.collections[c.parent]).toBeDefined();
      if (m.nav) expect(m.nav.label.length).toBeGreaterThan(0);
    }
    expect(getManifest('nope')).toBeUndefined();
  });
});
