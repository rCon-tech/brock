import type { Profile } from './profile';
import type { EngineItem } from './types';

const PER_PERSON = 3;

/**
 * For each shared element, the cards each person said yes to that carry it. This is what lets the
 * board lead with "you both said yes to black metal" instead of an empty list of matches (R19).
 */
export function evidenceFor(
  attributes: string[],
  profiles: Profile[],
  itemsById: Map<string, EngineItem>,
): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const attribute of attributes) {
    const perPerson: Record<string, string[]> = {};
    for (const p of profiles) {
      const carrying = p.likedIds
        .map((id) => itemsById.get(id))
        .filter((i): i is EngineItem => !!i && i.attributes.includes(attribute));
      // Prefer products (they have a name) and cards that carry several shared elements.
      carrying.sort((a, b) => {
        const shared = (i: EngineItem) => attributes.filter((x) => i.attributes.includes(x)).length;
        return (
          (a.tier === 'micro' ? 0 : 1) - (b.tier === 'micro' ? 0 : 1) ||
          shared(b) - shared(a) ||
          a.id.localeCompare(b.id)
        );
      });
      perPerson[p.personId] = carrying.slice(0, PER_PERSON).map((i) => i.id);
    }
    out[attribute] = perPerson;
  }
  return out;
}
