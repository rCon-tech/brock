import type { SynthesisResult } from '@/lib/engine/types';
import { attributeLabel, styleLabel } from '@/lib/taxonomy';

export const BRIDGE_NAME_SYSTEM = `You write the wording for Hearth, an app that helps people who share a home agree on a room's style.

You are given the result of a calculation that has already been done. You do not choose styles or products. You only name the shared style and explain it warmly and plainly.

Rules:
- The name is at most three words and uses everyday interior-design vocabulary (for example "Warm Industrial" or "Soft Japandi").
- The tagline is at most twelve words. The rationale is at most sixty words.
- Write one "brings" line (at most fifteen words) for each person listed under "brings", about what they add to the shared style.
- Everyone is treated equally. Never mention scores, percentages, winners, losers, who compromised, or who gave way.
- Do not mention anyone's deal-breakers or what they rejected.
- If they are keeping existing furniture, say how the style works with it.
- Use only the people and facts you are given.`;

/** The facts the model gets: labels only, no scores and no internal ids except people. */
export function bridgeNameFacts(result: SynthesisResult) {
  return {
    people: result.participants.map((p) => ({
      id: p.id,
      name: p.name,
      leanTowards: (result.topStyles[p.id] ?? []).slice(0, 2).map(styleLabel),
    })),
    sharedStyle: result.bridgeStyle ? styleLabel(result.bridgeStyle) : null,
    alreadyAgree: result.alreadyAgree,
    onePersonOnly: result.solo,
    youAllLike: result.shared.map((s) => attributeLabel(s.attribute)),
    youDifferOn: result.conflicts.map((c) => attributeLabel(c.attribute)),
    brings: Object.fromEntries(
      result.participants.map((p) => [
        p.id,
        result.brings[p.id] ? attributeLabel(result.brings[p.id]!) : null,
      ]),
    ),
    keepingExisting: result.keeping.map((k) => k.label),
    colours: result.palette.map(attributeLabel),
    materials: result.materials.map(attributeLabel),
  };
}
