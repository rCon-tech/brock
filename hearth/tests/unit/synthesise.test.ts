import { describe, expect, it } from 'vitest';
import { EMPTY_CONTEXT, type ProjectContext } from '@/lib/context';
import { meanFitPerPerson } from '@/lib/engine/compromise';
import { inputsHash, synthesise } from '@/lib/engine/synthesise';
import type { Person } from '@/lib/engine/types';
import { decksFor, persona, styleIs, world } from '../helpers/world';

const w = world();
const decks = decksFor(w);

function run(people: Person[], context: ProjectContext = EMPTY_CONTEXT, budgetBand = null) {
  return synthesise({
    roomType: 'living_room',
    context,
    budgetBand,
    people,
    items: w.items,
    centroids: w.centroids,
  });
}

const industrial = (id = 'a') => persona(id, w, decks, styleIs('industrial', 'brutalist', 'contemporary'));
const minimalist = (id = 'b') => persona(id, w, decks, styleIs('minimalist', 'japandi', 'scandinavian'));

describe('industrial vs minimalist (the pitch)', () => {
  const r = run([industrial(), minimalist()]);

  it('finds no exact matches and leads with the bridge (R19)', () => {
    expect(r.exactMicro).toHaveLength(0);
    expect(r.exactMacro).toHaveLength(0);
    expect(r.lead).toBe('bridge');
  });

  it('proposes the style between them, not either person’s own', () => {
    expect(r.alreadyAgree).toBe(false);
    expect(r.bridgeStyle).toBe('warm_minimal');
    expect(r.topStyles.a[0]).not.toBe(r.bridgeStyle);
    expect(r.topStyles.b[0]).not.toBe(r.bridgeStyle);
  });

  it('shows shared elements with evidence from both people (R19)', () => {
    expect(r.shared.length).toBeGreaterThan(0);
    for (const s of r.shared) {
      expect(s.evidence.a.length).toBeGreaterThan(0);
      expect(s.evidence.b.length).toBeGreaterThan(0);
    }
  });

  it('gives each person something of theirs on the board (R21)', () => {
    expect(r.brings.a).toBeTruthy();
    expect(r.brings.b).toBeTruthy();
    for (const person of ['a', 'b']) {
      const attr = r.brings[person]!;
      expect(r.picks.some((p) => w.byId.get(p.itemId)!.attributes.includes(attr))).toBe(true);
    }
  });

  it('keeps satisfaction balanced between the two people (R21)', () => {
    const fit = meanFitPerPerson(r.picks);
    expect(Math.abs(fit.a - fit.b)).toBeLessThanOrEqual(0.1);
    expect(Math.min(fit.a, fit.b)).toBeGreaterThan(0.1);
  });

  it('picks 12 products, at most 2 per category, none either person rejected', () => {
    expect(r.picks).toHaveLength(12);
    const perCat = new Map<string, number>();
    for (const p of r.picks) perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1);
    expect(Math.max(...perCat.values())).toBeLessThanOrEqual(2);
    const rejected = new Set(
      [industrial(), minimalist()].flatMap((p) => p.swipes.filter((s) => s.value === -1).map((s) => s.itemId)),
    );
    for (const p of r.picks) expect(rejected.has(p.itemId)).toBe(false);
  });

  it('stores swap candidates per category (R28)', () => {
    const cats = new Set(r.picks.map((p) => p.category));
    for (const c of cats) expect(r.swapQueue[c]?.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(run([industrial(), minimalist()])).toEqual(r);
  });
});

describe('agreement', () => {
  it('leads with Agreed when three or more products match', () => {
    const warm = styleIs(
      'mid_century',
      'retro_70s',
      'boho',
      'rustic',
      'traditional',
      'cottagecore',
      'french_country',
      'mediterranean',
      'modern_farmhouse',
      'industrial',
      'wabi_sabi',
      'eclectic',
    );
    const r = run([persona('a', w, decks, warm), persona('b', w, decks, warm)]);
    expect(r.exactMicro.length).toBeGreaterThanOrEqual(3);
    expect(r.lead).toBe('agreed');
    expect(r.alreadyAgree).toBe(true);
  });

  it('works for three people', () => {
    const third = persona('c', w, decks, styleIs('mid_century', 'retro_70s', 'boho'));
    const r = run([industrial(), minimalist(), third]);
    expect(r.participants).toHaveLength(3);
    expect(Object.keys(r.brings)).toHaveLength(3);
    expect(r.picks).toHaveLength(12);
    const fit = meanFitPerPerson(r.picks);
    expect(Math.max(...Object.values(fit)) - Math.min(...Object.values(fit))).toBeLessThanOrEqual(0.15);
  });

  it('builds a solo board from one person’s swipes (R31)', () => {
    const r = run([industrial()]);
    expect(r.solo).toBe(true);
    expect(r.lead).toBe('bridge');
    expect(r.conflicts).toHaveLength(0);
    expect(r.brings).toEqual({});
    expect(['industrial', 'brutalist', 'contemporary']).toContain(r.bridgeStyle);
    expect(r.picks).toHaveLength(12);
  });

  it('copes with nobody having swiped', () => {
    const r = run([
      { id: 'a', name: 'A', swipes: [], vetoes: [] },
      { id: 'b', name: 'B', swipes: [], vetoes: [] },
    ]);
    expect(r.bridgeStyle).toBeNull();
    expect(r.exactMicro).toEqual([]);
  });
});

describe('vetoes (R9, R22)', () => {
  it('keeps vetoed items and vetoed attributes off the board', () => {
    const velvet = w.items.find((i) => i.tier === 'micro' && i.attributes.includes('material:velvet'))!;
    const a = persona('a', w, decks, styleIs('industrial', 'brutalist'), [
      { itemId: velvet.id, attribute: 'material:velvet' },
    ]);
    const r = run([a, minimalist()]);
    expect(r.vetoedAttributes).toEqual(['material:velvet']);
    expect(r.vetoedItemIds).toContain(velvet.id);
    for (const p of r.picks) {
      expect(w.byId.get(p.itemId)!.attributes).not.toContain('material:velvet');
    }
    expect(r.hybridRooms.map((id) => w.byId.get(id)!.attributes)).toSatisfy((all: string[][]) =>
      all.every((attrs) => !attrs.includes('material:velvet')),
    );
  });

  it('never attributes a veto to a person on the result', () => {
    const velvet = w.items.find((i) => i.attributes.includes('material:velvet'))!;
    const a = persona('a', w, decks, styleIs('industrial'), [{ itemId: velvet.id, attribute: 'material:velvet' }]);
    const json = JSON.stringify(run([a, minimalist()]).vetoedAttributes);
    expect(json).not.toContain('"a"');
  });
});

describe('room context (R14, R15)', () => {
  const grey: ProjectContext = { ...EMPTY_CONTEXT, keeping: [{ category: 'sofa', colour: 'grey' }] };

  it('never suggests a sofa when keeping one, and badges pieces that go with it', () => {
    const d = decksFor(w, 'living_room', { context: grey });
    const a = persona('a', w, d, styleIs('industrial', 'brutalist', 'contemporary'));
    const b = persona('b', w, d, styleIs('minimalist', 'japandi', 'scandinavian'));
    const r = run([a, b], grey);
    expect(r.picks.map((p) => p.category)).not.toContain('sofa');
    expect(r.exactMicro.map((id) => w.byId.get(id)!.category)).not.toContain('sofa');
    expect(r.picks.filter((p) => p.goesWith === 'grey sofa').length).toBeGreaterThanOrEqual(3);
    expect(r.keeping).toEqual([{ category: 'sofa', label: 'grey sofa' }]);
  });

  const soft = (i: { attributes: string[] }) =>
    i.attributes.includes('practical:light_fabric') || i.attributes.includes('material:boucle');
  const riskyCount = (ctx: ProjectContext) => {
    const a = persona('a', w, decks, soft);
    const b = persona('b', w, decks, (i) => soft(i) || styleIs('organic_modern', 'wabi_sabi')(i));
    const r = run([a, b], ctx);
    return {
      r,
      risky: r.picks.slice(0, 6).filter((p) => w.byId.get(p.itemId)!.attributes.includes('practical:light_fabric')).length,
    };
  };

  it('pushes risky fabrics down for a household with a dog, with a badge (R15)', () => {
    const none = riskyCount(EMPTY_CONTEXT);
    const dog = riskyCount({ ...EMPTY_CONTEXT, household: { dog: true, cat: false, youngKids: false } });
    expect(none.risky).toBeGreaterThan(0);
    expect(dog.risky).toBeLessThan(none.risky);
    const badged = dog.r.picks.filter((p) => w.byId.get(p.itemId)!.attributes.includes('practical:light_fabric'));
    for (const p of badged) expect(p.householdRisks).toContain('pets');
  });

  it('hides risky items entirely when the switch is on', () => {
    const { r } = riskyCount({
      ...EMPTY_CONTEXT,
      household: { dog: true, cat: false, youngKids: false },
      hidePracticalRisks: true,
    });
    for (const p of r.picks) {
      expect(w.byId.get(p.itemId)!.attributes).not.toContain('practical:light_fabric');
    }
  });
});

describe('inputs hash', () => {
  it('ignores swipe order and changes when a swipe changes', () => {
    const a = industrial();
    const base = { roomType: 'living_room', context: EMPTY_CONTEXT, budgetBand: null };
    const h1 = inputsHash({ ...base, people: [a, minimalist()] });
    const reversed = { ...a, swipes: a.swipes.slice().reverse() };
    expect(inputsHash({ ...base, people: [minimalist(), reversed] })).toBe(h1);
    const flipped = { ...a, swipes: a.swipes.map((s, i) => (i === 0 ? { ...s, value: -s.value as 1 | -1 } : s)) };
    expect(inputsHash({ ...base, people: [flipped, minimalist()] })).not.toBe(h1);
  });
});
