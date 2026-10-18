import { describe, expect, it } from 'vitest';
import { MICRO_COUNT, QUOTAS, quotasFor } from '@/lib/engine/quotas';
import type { RoomType } from '@/lib/taxonomy';

const sum = (q: Record<string, number | undefined>) =>
  Object.values(q).reduce<number>((a, b) => a + (b ?? 0), 0);

describe('micro deck quotas', () => {
  it.each(Object.keys(QUOTAS) as RoomType[])('%s sums to the deck size', (room) => {
    expect(sum(QUOTAS[room])).toBe(MICRO_COUNT);
  });

  it('removes kept categories and redistributes their cards (R14)', () => {
    const q = quotasFor('living_room', ['sofa', 'rug']);
    expect(q.sofa).toBeUndefined();
    expect(q.rug).toBeUndefined();
    expect(sum(q)).toBe(MICRO_COUNT);
  });

  it('keeps the deck full even when most categories are kept', () => {
    const q = quotasFor('dining_room', ['dining_table', 'dining_chair', 'sideboard', 'rug']);
    expect(sum(q)).toBe(MICRO_COUNT);
  });
});
