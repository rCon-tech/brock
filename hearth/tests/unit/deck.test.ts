import { describe, expect, it } from 'vitest';
import { EMPTY_CONTEXT } from '@/lib/context';
import { priceCapPence } from '@/lib/budget';
import { dot, normalise, mean } from '@/lib/engine/vector';
import { buildDecks, shuffleDeck } from '@/lib/engine/deck';
import { decksFor, world } from '../helpers/world';

const w = world();

describe('deck building', () => {
  it('builds 12 photos and 18 products plus reserves', () => {
    const d = decksFor(w);
    expect(d.macro).toHaveLength(12);
    expect(d.micro).toHaveLength(18);
    expect(d.reserveMacro).toHaveLength(2);
    expect(d.reserveMicro).toHaveLength(2);
    expect(new Set([...d.macro, ...d.micro, ...d.reserveMacro, ...d.reserveMicro]).size).toBe(34);
  });

  it('covers at least 8 different styles in the photos', () => {
    const styles = new Set(decksFor(w).macro.map((id) => w.byId.get(id)!.primaryStyle));
    expect(styles.size).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic for a seed and different for another', () => {
    expect(decksFor(w, 'living_room', { seed: 'x' })).toEqual(decksFor(w, 'living_room', { seed: 'x' }));
    expect(decksFor(w, 'living_room', { seed: 'x' }).macro).not.toEqual(
      decksFor(w, 'living_room', { seed: 'y' }).macro,
    );
  });

  it('follows the category quotas', () => {
    const cats = decksFor(w).micro.map((id) => w.byId.get(id)!.category);
    expect(cats.filter((c) => c === 'sofa')).toHaveLength(3);
    expect(cats.filter((c) => c === 'rug')).toHaveLength(3);
  });

  it('only uses items for the requested room', () => {
    const d = decksFor(w, 'bedroom');
    for (const id of [...d.macro, ...d.micro]) expect(w.byId.get(id)!.roomTypes).toContain('bedroom');
    expect(d.micro.map((id) => w.byId.get(id)!.category)).toContain('bed');
  });

  it('drops kept categories from the deck but keeps it full (R14)', () => {
    const d = decksFor(w, 'living_room', {
      context: { ...EMPTY_CONTEXT, keeping: [{ category: 'sofa', colour: 'grey' }] },
    });
    expect(d.micro).toHaveLength(18);
    expect(d.micro.map((id) => w.byId.get(id)!.category)).not.toContain('sofa');
  });

  it('respects the budget band (R13)', () => {
    const d = decksFor(w, 'living_room', { budgetBand: 'low' });
    for (const id of d.micro) {
      const item = w.byId.get(id)!;
      if (item.pricePence != null) {
        expect(item.pricePence).toBeLessThanOrEqual(priceCapPence('low', item.category!));
      }
    }
  });

  it('respects size limits but keeps items with unknown sizes (R16)', () => {
    const d = decksFor(w, 'living_room', {
      context: { ...EMPTY_CONTEXT, maxSize: [{ category: 'sofa', widthCm: 180 }] },
    });
    for (const id of d.micro) {
      const item = w.byId.get(id)!;
      if (item.category === 'sofa' && item.widthCm != null) {
        expect(item.widthCm).toBeLessThanOrEqual(180);
      }
    }
  });

  it('skips cards everyone agrees on', () => {
    const base = decksFor(w);
    const skip = new Set(base.micro.slice(0, 5));
    const d = decksFor(w, 'living_room', { excludeIds: skip });
    for (const id of d.micro) expect(skip.has(id)).toBe(false);
  });

  it('pulls half the photos from near the previous bridge for a next room (R24)', () => {
    const target = w.items.find((i) => i.tier === 'macro' && i.primaryStyle === 'japandi')!;
    const near = normalise(target.embedding);
    const d = buildDecks({
      roomType: 'living_room',
      items: w.items,
      context: EMPTY_CONTEXT,
      budgetBand: null,
      seed: 'near',
      nearVector: near,
    });
    const photos = w.items.filter((i) => i.tier === 'macro' && i.roomTypes.includes('living_room'));
    const sims = d.macro.map((id) => dot(w.byId.get(id)!.embedding, near));
    const allSims = photos.map((p) => dot(p.embedding, near));
    expect(mean(sims)).toBeGreaterThan(mean(allSims));
    expect(d.macro).toContain(target.id);
  });

  it('gives each person the same cards in their own order', () => {
    const d = decksFor(w);
    const a = shuffleDeck(d.micro, 'p1');
    const b = shuffleDeck(d.micro, 'p2');
    expect([...a].sort()).toEqual([...b].sort());
    expect(a).not.toEqual(b);
    expect(shuffleDeck(d.micro, 'p1')).toEqual(a);
  });
});
