import { attributeFamily } from '@/lib/taxonomy';
import { LOVE_THRESHOLD, type Profile } from './profile';

/**
 * R21: every person brings at least one element to the bridge. Picks each person's strongest
 * liked attribute that isn't contested and that some candidate product actually carries,
 * preferring different attributes for different people so the board shows two contributions.
 */
export function chooseBrings(
  profiles: Profile[],
  contested: Set<string>,
  availableAttributes: Set<string>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const claimed = new Set<string>();
  // People with the fewest options choose first.
  const options = profiles.map((p) => ({
    p,
    attrs: [...p.affinity]
      .filter(
        ([a, v]) =>
          v >= LOVE_THRESHOLD &&
          attributeFamily(a) !== 'practical' &&
          !contested.has(a) &&
          availableAttributes.has(a),
      )
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([a]) => a),
  }));
  options.sort((a, b) => a.attrs.length - b.attrs.length);
  for (const { p, attrs } of options) {
    const choice = attrs.find((a) => !claimed.has(a)) ?? attrs[0] ?? null;
    out[p.personId] = choice;
    if (choice) claimed.add(choice);
  }
  return out;
}
