import { createHash } from 'node:crypto';
import type { ProjectContext } from '@/lib/context';
import { attributeFamily, type BudgetBand } from '@/lib/taxonomy';
import { chooseBridge } from './bridge';
import { eligibleProducts, eligiblePhotos } from './constraints';
import { chooseBrings } from './contributions';
import { chooseCompromise, chooseHybridRooms } from './compromise';
import { evidenceFor } from './evidence';
import { exactMatches, sharedAndConflicts } from './matches';
import { buildProfile } from './profile';
import type { Centroid, EngineItem, Person, SynthesisResult } from './types';

export interface SynthesisInput {
  roomType: string;
  context: ProjectContext;
  budgetBand: BudgetBand | null;
  people: Person[];
  items: EngineItem[];
  centroids: Centroid[];
  statsBoost?: Map<string, number>;
}

/** Hash of everything that affects the board, so unchanged inputs skip a recompute. */
export function inputsHash(
  input: Omit<SynthesisInput, 'items' | 'centroids' | 'statsBoost'>,
): string {
  const people = input.people
    .map((p) => ({
      id: p.id,
      swipes: p.swipes.map((s) => `${s.itemId}:${s.value}:${s.round}`).sort(),
      vetoes: p.vetoes.map((v) => `${v.itemId}:${v.attribute ?? ''}`).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256')
    .update(JSON.stringify({ r: input.roomType, c: input.context, b: input.budgetBand, people }))
    .digest('hex');
}

const LEAD_THRESHOLD = 3;
const PALETTE_SIZE = 5;

function topByFrequency(attrs: string[], family: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const a of attrs) if (attributeFamily(a) === family) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([a]) => a);
}

/** The whole of §11.3 steps 1–9: pure, deterministic and fast. */
export function synthesise(input: SynthesisInput): SynthesisResult {
  const { people, context } = input;
  const itemsById = new Map(input.items.map((i) => [i.id, i]));
  const profiles = people.map((p) => buildProfile(p, itemsById, input.centroids));
  const keptCategories = new Set(context.keeping.map((k) => k.category as string));

  const exact = exactMatches(people, itemsById, keptCategories);
  const { shared, conflicts } = sharedAndConflicts(profiles);
  const evidence = evidenceFor(
    shared.map((s) => s.attribute),
    profiles,
    itemsById,
  );
  const bridge = chooseBridge(profiles, input.centroids);

  const vetoedItemIds = [...new Set(people.flatMap((p) => p.vetoes.map((v) => v.itemId)))];
  const vetoedAttributes = [
    ...new Set(
      people.flatMap((p) => p.vetoes.map((v) => v.attribute).filter((a): a is string => !!a)),
    ),
  ];
  const leftSwiped = new Set(profiles.flatMap((p) => p.dislikedIds));
  const exclude = new Set<string>([...vetoedItemIds, ...leftSwiped]);

  const candidates = eligibleProducts(input.items, {
    roomType: input.roomType,
    context,
    budgetBand: input.budgetBand,
  });
  const available = new Set(
    candidates
      .filter((c) => !exclude.has(c.id) && !c.attributes.some((a) => vetoedAttributes.includes(a)))
      .flatMap((c) => c.attributes),
  );
  const contested = new Set(conflicts.map((c) => c.attribute));
  const brings = people.length > 1 ? chooseBrings(profiles, contested, available) : {};

  const { picks, swapQueue } = chooseCompromise({
    candidates,
    profiles,
    excludeItemIds: exclude,
    vetoedAttributes: new Set(vetoedAttributes),
    context,
    statsBoost: input.statsBoost,
    brings,
  });

  const hybridRooms = chooseHybridRooms(
    eligiblePhotos(input.items, input.roomType),
    profiles,
    exclude,
    new Set(vetoedAttributes),
  );

  const boardAttrs = [
    ...exact.micro.flatMap((id) => itemsById.get(id)?.attributes ?? []),
    ...picks.flatMap((p) => itemsById.get(p.itemId)?.attributes ?? []),
    ...shared.map((s) => s.attribute),
  ];

  const solo = people.length === 1;
  return {
    participants: people.map((p) => ({ id: p.id, name: p.name })),
    solo,
    lead: !solo && exact.micro.length >= LEAD_THRESHOLD ? 'agreed' : 'bridge',
    bridgeStyle: bridge.style,
    alreadyAgree: bridge.alreadyAgree,
    topStyles: bridge.topStyles,
    lowConfidence: profiles.some((p) => p.confidence < 0.6),
    exactMicro: exact.micro,
    exactMacro: exact.macro,
    shared: shared.map((s) => ({ ...s, evidence: evidence[s.attribute] ?? {} })),
    conflicts,
    brings,
    picks,
    swapQueue,
    hybridRooms,
    vetoedAttributes,
    vetoedItemIds,
    palette: topByFrequency(boardAttrs, 'colour', PALETTE_SIZE),
    materials: topByFrequency(boardAttrs, 'material', PALETTE_SIZE),
    keeping: context.keeping.map((k) => ({
      category: k.category,
      label: [k.colour, k.material, k.category.replace(/_/g, ' ')].filter(Boolean).join(' '),
    })),
  };
}
