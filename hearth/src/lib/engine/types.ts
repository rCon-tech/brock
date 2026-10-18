import type { Vec } from './vector';

export interface EngineItem {
  id: string;
  tier: 'macro' | 'micro';
  category: string | null;
  roomTypes: string[];
  /** Normalised embedding. */
  embedding: Vec;
  /** `family:value` attributes. */
  attributes: string[];
  primaryStyle: string | null;
  styleWeights: Record<string, number>;
  pricePence: number | null;
  inStock: boolean;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
}

export interface Centroid {
  slug: string;
  vector: Vec;
}

export type SwipeRound = 'macro' | 'micro' | 'bridge';

export interface PersonSwipe {
  itemId: string;
  value: 1 | -1;
  round: SwipeRound;
}

export interface PersonVeto {
  itemId: string;
  /** A `family:value` attribute the person named as the deal-breaker (R9). */
  attribute?: string | null;
}

export interface Person {
  id: string;
  name: string;
  swipes: PersonSwipe[];
  vetoes: PersonVeto[];
}

export interface Pick {
  itemId: string;
  category: string;
  /** e.g. "grey sofa": drives the "Goes with your grey sofa" badge (R14). */
  goesWith: string | null;
  /** "pets" / "kids": drives the "may not suit" badge (R15). */
  householdRisks: ('pets' | 'kids')[];
  /** Internal only. The UI never shows scores (R20). */
  fit: Record<string, number>;
  /** Set when the pick was reserved so a person has something of theirs on the board (R21). */
  reservedFor?: string;
}

export interface SharedElement {
  attribute: string;
  /** Items each person said yes to that carry the attribute (R19). */
  evidence: Record<string, string[]>;
}

export interface ConflictElement {
  attribute: string;
  lovedBy: string[];
  avoidedBy: string[];
}

export interface SynthesisResult {
  participants: { id: string; name: string }[];
  solo: boolean;
  lead: 'agreed' | 'bridge';
  bridgeStyle: string | null;
  alreadyAgree: boolean;
  topStyles: Record<string, string[]>;
  lowConfidence: boolean;
  exactMicro: string[];
  exactMacro: string[];
  shared: SharedElement[];
  conflicts: ConflictElement[];
  /** The attribute each person brings to the bridge (R21). */
  brings: Record<string, string | null>;
  picks: Pick[];
  /** Next-best candidates per category for "show me another" (R28). */
  swapQueue: Record<string, string[]>;
  hybridRooms: string[];
  /** Deal-breakers, anonymous on purpose (R22). */
  vetoedAttributes: string[];
  vetoedItemIds: string[];
  /** Colour attributes that recur across the board, most common first. */
  palette: string[];
  materials: string[];
  keeping: { category: string; label: string }[];
}
