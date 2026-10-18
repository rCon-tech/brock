import { z } from 'zod';
import type { SynthesisResult } from '@/lib/engine/types';
import type { BridgeNaming } from './bridge-fallback';

export const bridgeNameSchema = z.object({
  name: z.string().describe('The shared style, at most three words, e.g. "Warm Industrial".'),
  tagline: z.string().describe('At most twelve words.'),
  rationale: z.string().describe('At most sixty words explaining why this suits everyone.'),
  contributions: z
    .array(
      z.object({
        participantId: z.string(),
        brings: z
          .string()
          .describe('At most fifteen words, positive, about what this person adds.'),
      }),
    )
    .describe('One entry per person in "brings".'),
});
export type BridgeNameOutput = z.infer<typeof bridgeNameSchema>;

/** Words that would turn a shared board into a contest (R20). */
const CONTEST_WORDS =
  /\d+\s?%|\bscores?\b|\bwon\b|\bwins?\b|\blost\b|\bloses?\b|\bcompromis(?:e|ed|ing)\b|\bgave (?:in|way|up)\b|\bgiv(?:e|ing) way\b|\bwinner\b|\bloser\b|\bmore than the other\b/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * The AI only writes labels, so its output is checked hard and anything off falls back to the
 * plain wording: never invented people, never scores or "who gave way", always within limits.
 */
export function validateNaming(
  output: BridgeNameOutput,
  result: SynthesisResult,
): BridgeNaming | null {
  const people = new Set(result.participants.map((p) => p.id));
  const text = [
    output.name,
    output.tagline,
    output.rationale,
    ...output.contributions.map((c) => c.brings),
  ];
  if (text.some((t) => CONTEST_WORDS.test(t))) return null;
  if (words(output.name) === 0 || words(output.name) > 3) return null;
  if (words(output.tagline) > 12 || words(output.rationale) > 60) return null;
  const contributions = output.contributions.filter(
    (c) => people.has(c.participantId) && words(c.brings) <= 15,
  );
  const seen = new Set<string>();
  for (const c of contributions) {
    if (seen.has(c.participantId)) return null;
    seen.add(c.participantId);
  }
  return {
    name: output.name.trim(),
    tagline: output.tagline.trim(),
    rationale: output.rationale.trim(),
    contributions,
  };
}
