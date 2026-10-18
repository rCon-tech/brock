import type { SynthesisResult } from '@/lib/engine/types';
import { attributeLabel, styleLabel } from '@/lib/taxonomy';

export interface BridgeNaming {
  name: string;
  tagline: string;
  rationale: string;
  contributions: { participantId: string; brings: string }[];
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The wording when the AI call is unavailable or fails: plain, deterministic, and never about
 * scores or who gave way (R20). The board is complete without the AI; this only writes the labels.
 */
export function fallbackNaming(result: SynthesisResult): BridgeNaming {
  const name = result.bridgeStyle ? styleLabel(result.bridgeStyle) : 'Your style';
  const shared = result.shared.slice(0, 3).map((s) => attributeLabel(s.attribute));
  const names = result.participants.map((p) => p.name);
  const tagline = result.solo
    ? 'A style built from your swipes'
    : result.alreadyAgree
      ? 'You already see eye to eye'
      : `Where ${list(names)} meet`;
  const rationale = result.solo
    ? `Based on your swipes, ${name} suits you best${shared.length ? `, especially ${list(shared)}` : ''}.`
    : result.alreadyAgree
      ? `You were all drawn to ${name}${shared.length ? `, and you share a love of ${list(shared)}` : ''}.`
      : `${name} gives each of you room${shared.length ? `, and you both lean towards ${list(shared)}` : ''}.`;
  const contributions = result.participants.flatMap((p) => {
    const attr = result.brings[p.id];
    return attr ? [{ participantId: p.id, brings: `Brings ${attributeLabel(attr)}` }] : [];
  });
  return { name, tagline, rationale, contributions };
}
