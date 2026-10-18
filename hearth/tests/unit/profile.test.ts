import { describe, expect, it } from 'vitest';
import { buildProfile, tasteSentence, LOVE_THRESHOLD } from '@/lib/engine/profile';
import { decksFor, persona, styleIs, world } from '../helpers/world';

const w = world();
const decks = decksFor(w);

describe('taste profile', () => {
  it('points towards the styles a person likes', () => {
    const p = persona('a', w, decks, styleIs('industrial', 'brutalist', 'contemporary'));
    const profile = buildProfile(p, w.byId, w.centroids);
    expect(['industrial', 'brutalist', 'contemporary']).toContain(profile.topStyles[0].style);
    expect(profile.topStyles).toHaveLength(3);
  });

  it('has no taste before any swipes', () => {
    const profile = buildProfile({ id: 'x', name: 'X', swipes: [], vetoes: [] }, w.byId, w.centroids);
    expect(profile.taste).toBeNull();
    expect(profile.topStyles).toEqual([]);
    expect(tasteSentence(profile)).toMatch(/swipe a few more/i);
  });

  it('does not let a yes-to-everything swiper "love" every attribute', () => {
    const p = persona('a', w, decks, () => true);
    const profile = buildProfile(p, w.byId, w.centroids);
    const loved = [...profile.affinity.values()].filter((v) => v >= LOVE_THRESHOLD);
    expect(loved).toHaveLength(0);
  });

  it('measures affinity against the person’s own baseline', () => {
    const p = persona('a', w, decks, (i) => i.attributes.includes('material:brass'));
    const profile = buildProfile(p, w.byId, w.centroids);
    expect(profile.affinity.get('material:brass')!).toBeGreaterThan(LOVE_THRESHOLD);
  });

  it('treats a named deal-breaker as the most negative affinity (R9)', () => {
    const velvet = w.items.find((i) => i.attributes.includes('material:velvet'))!;
    const p = persona('a', w, decks, () => true, [{ itemId: velvet.id, attribute: 'material:velvet' }]);
    const profile = buildProfile(p, w.byId, w.centroids);
    expect(profile.affinity.get('material:velvet')).toBe(-0.5);
  });

  it('counts a veto as a left swipe even if the card was never swiped', () => {
    const item = w.items[0];
    const profile = buildProfile(
      { id: 'x', name: 'X', swipes: [], vetoes: [{ itemId: item.id }] },
      w.byId,
      w.centroids,
    );
    expect(profile.dislikedIds).toContain(item.id);
  });

  it('writes a one-line style summary (R23)', () => {
    const p = persona('a', w, decks, styleIs('industrial', 'brutalist'));
    expect(tasteSentence(buildProfile(p, w.byId, w.centroids))).toMatch(/^You lean [A-Z]/);
  });
});
