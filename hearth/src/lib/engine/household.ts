import type { ProjectContext } from '@/lib/context';

const PET_RISKS = [
  'practical:delicate',
  'practical:light_fabric',
  'practical:loop_pile',
  'practical:high_maintenance',
];
const KID_RISKS = [
  'practical:glass_top',
  'practical:sharp_corners',
  'practical:delicate',
  'practical:light_fabric',
];

export type HouseholdWho = 'pets' | 'kids';

/** Which household groups an item's practical tags are a risk for (R15). */
export function householdRisks(
  household: ProjectContext['household'],
  attributes: readonly string[],
): HouseholdWho[] {
  const out: HouseholdWho[] = [];
  if ((household.dog || household.cat) && attributes.some((a) => PET_RISKS.includes(a))) {
    out.push('pets');
  }
  if (household.youngKids && attributes.some((a) => KID_RISKS.includes(a))) out.push('kids');
  return out;
}

/** 0..1 risk used as a soft penalty in scoring. */
export function householdRiskScore(
  household: ProjectContext['household'],
  attributes: readonly string[],
): number {
  return Math.min(1, householdRisks(household, attributes).length);
}
