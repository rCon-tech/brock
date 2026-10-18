import { describe, expect, it } from 'vitest';
import { EMPTY_CONTEXT } from '@/lib/context';
import { applyBoardSignals } from '@/lib/engine/feedback';
import { nextSwap } from '@/lib/engine/swap';
import { synthesise } from '@/lib/engine/synthesise';
import { TIEBREAK_COUNT, tiebreakCards } from '@/lib/engine/tiebreak';
import { decksFor, persona, styleIs, world } from '../helpers/world';

const w = world();
const decks = decksFor(w);
const a = persona('a', w, decks, styleIs('industrial', 'brutalist', 'contemporary'));
const b = persona('b', w, decks, styleIs('minimalist', 'japandi', 'scandinavian'));
const base = {
  roomType: 'living_room',
  context: EMPTY_CONTEXT,
  budgetBand: null,
  items: w.items,
  centroids: w.centroids,
};
const result = synthesise({ ...base, people: [a, b] });

describe('swaps (R28)', () => {
  it('offers the next candidate in the same category', () => {
    const pick = result.picks[0];
    const out = nextSwap(result, pick.category, new Set());
    expect(out.itemId).toBeTruthy();
    expect(w.byId.get(out.itemId!)!.category).toBe(pick.category);
    expect(result.picks.map((p) => p.itemId)).not.toContain(out.itemId);
  });

  it('skips anything unavailable and reports when a category runs out', () => {
    const pick = result.picks[0];
    const queue = result.swapQueue[pick.category];
    const out = nextSwap(result, pick.category, new Set(queue.slice(0, 1)));
    expect(out.itemId).toBe(queue[1] ?? null);
    expect(nextSwap(result, pick.category, new Set(queue)).itemId).toBeNull();
    expect(nextSwap(result, 'nonexistent', new Set()).itemId).toBeNull();
  });
});

describe('board signals', () => {
  it('turns ✕, swaps and ❤️ into swipes and ignores 🤔', () => {
    const [p1, p2, p3] = result.picks;
    const people = applyBoardSignals([a, b], {
      reactions: [
        { participantId: 'a', itemId: p1.itemId, reaction: 'no' },
        { participantId: 'b', itemId: p2.itemId, reaction: 'love' },
        { participantId: 'b', itemId: p3.itemId, reaction: 'unsure' },
      ],
      swapsOut: [{ participantId: 'b', itemId: result.picks[3].itemId }],
    });
    const find = (pid: string, item: string) =>
      people.find((p) => p.id === pid)!.swipes.find((s) => s.itemId === item);
    expect(find('a', p1.itemId)?.value).toBe(-1);
    expect(find('b', p2.itemId)?.value).toBe(1);
    expect(find('b', p3.itemId)).toBeUndefined();
    expect(find('b', result.picks[3].itemId)?.value).toBe(-1);
  });

  it('removes a ✕’d item from the next board', () => {
    const rejected = result.picks[0].itemId;
    const people = applyBoardSignals([a, b], {
      reactions: [{ participantId: 'a', itemId: rejected, reaction: 'no' }],
      swapsOut: [],
    });
    const next = synthesise({ ...base, people });
    expect(next.picks.map((p) => p.itemId)).not.toContain(rejected);
  });
});

describe('tie-breaker (R11)', () => {
  it('offers eight unswiped picks in board order', () => {
    const cards = tiebreakCards(result, new Set());
    expect(cards).toHaveLength(TIEBREAK_COUNT);
    expect(cards).toEqual(result.picks.slice(0, TIEBREAK_COUNT).map((p) => p.itemId));
  });

  it('skips anything already swiped or used in an earlier round', () => {
    const swiped = new Set([result.picks[0].itemId]);
    const used = new Set([result.picks[1].itemId]);
    const cards = tiebreakCards(result, swiped, used);
    expect(cards).not.toContain(result.picks[0].itemId);
    expect(cards).not.toContain(result.picks[1].itemId);
    expect(cards).toHaveLength(TIEBREAK_COUNT);
  });

  it('a mutual yes becomes an exact match on the next board', () => {
    const [target] = tiebreakCards(result, new Set());
    const people = [a, b].map((p) => ({
      ...p,
      swipes: [...p.swipes, { itemId: target, value: 1 as const, round: 'bridge' as const }],
    }));
    const next = synthesise({ ...base, people });
    expect(next.exactMicro).toContain(target);
  });
});
