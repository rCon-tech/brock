import { attributeFamily } from '@/lib/taxonomy';
import { LOVE_THRESHOLD, type Profile } from './profile';
import type { ConflictElement, EngineItem, Person, SharedElement } from './types';

export interface ExactMatches {
  micro: string[];
  macro: string[];
}

/** Items every participant swiped right on, minus anything vetoed or in a kept category. */
export function exactMatches(
  people: Person[],
  itemsById: Map<string, EngineItem>,
  keptCategories: Set<string>,
): ExactMatches {
  if (people.length === 0) return { micro: [], macro: [] };
  const vetoed = new Set(people.flatMap((p) => p.vetoes.map((v) => v.itemId)));
  const rightSets = people.map(
    (p) => new Set(p.swipes.filter((s) => s.value === 1).map((s) => s.itemId)),
  );
  const out: ExactMatches = { micro: [], macro: [] };
  for (const id of rightSets[0]) {
    if (!rightSets.every((set) => set.has(id)) || vetoed.has(id)) continue;
    const item = itemsById.get(id);
    if (!item) continue;
    if (item.tier === 'micro') {
      if (item.category && keptCategories.has(item.category)) continue;
      if (!item.inStock) continue;
      out.micro.push(id);
    } else {
      out.macro.push(id);
    }
  }
  return out;
}

const MAX_SHARED = 8;
const MAX_CONFLICTS = 6;

/** Attributes everyone leans towards, and attributes the group splits on. */
export function sharedAndConflicts(profiles: Profile[]): {
  shared: Omit<SharedElement, 'evidence'>[];
  conflicts: ConflictElement[];
} {
  const attrs = new Set<string>();
  for (const p of profiles) for (const a of p.affinity.keys()) attrs.add(a);

  const shared: { attribute: string; min: number }[] = [];
  const conflicts: (ConflictElement & { spread: number })[] = [];
  for (const attribute of attrs) {
    if (attributeFamily(attribute) === 'practical') continue;
    const values = profiles.map((p) => p.affinity.get(attribute));
    if (values.every((v) => v !== undefined && v >= LOVE_THRESHOLD)) {
      shared.push({ attribute, min: Math.min(...(values as number[])) });
    }
    const lovedBy = profiles.filter((p) => (p.affinity.get(attribute) ?? 0) >= LOVE_THRESHOLD);
    const avoidedBy = profiles.filter((p) => (p.affinity.get(attribute) ?? 0) <= -LOVE_THRESHOLD);
    if (lovedBy.length > 0 && avoidedBy.length > 0) {
      const all = profiles.map((p) => p.affinity.get(attribute) ?? 0);
      conflicts.push({
        attribute,
        lovedBy: lovedBy.map((p) => p.personId),
        avoidedBy: avoidedBy.map((p) => p.personId),
        spread: Math.max(...all) - Math.min(...all),
      });
    }
  }
  shared.sort((a, b) => b.min - a.min || a.attribute.localeCompare(b.attribute));
  conflicts.sort((a, b) => b.spread - a.spread || a.attribute.localeCompare(b.attribute));
  return {
    shared: shared.slice(0, MAX_SHARED).map(({ attribute }) => ({ attribute })),
    conflicts: conflicts.slice(0, MAX_CONFLICTS).map(({ spread, ...c }) => (void spread, c)),
  };
}
