import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { env } from '@/lib/env';
import type { SynthesisResult } from '@/lib/engine/types';
import { fallbackNaming, type BridgeNaming } from './bridge-fallback';
import { BRIDGE_NAME_SYSTEM, bridgeNameFacts } from './prompts/bridge-name';
import { bridgeNameSchema, validateNaming } from './schemas';

export const CLAUDE_MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Names the board with Claude when a key is configured, and with plain deterministic wording
 * otherwise. Any failure, refusal or off-brief answer falls back too: the board never waits on,
 * or depends on, the AI.
 */
export async function nameBridgeFor(
  result: SynthesisResult,
): Promise<BridgeNaming & { model: string | null }> {
  if (!env.ANTHROPIC_API_KEY) return { ...fallbackNaming(result), model: null };

  const response = await getClient().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    // If a safety classifier declines, re-run on Anthropic's recommended substitute.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    system: BRIDGE_NAME_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(bridgeNameFacts(result)) }],
    output_config: { effort: 'low', format: zodOutputFormat(bridgeNameSchema) },
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { ...fallbackNaming(result), model: null };
  }
  const checked = validateNaming(response.parsed_output, result);
  if (!checked) return { ...fallbackNaming(result), model: null };
  // Keep a line for everyone with something to bring, even if the model skipped one.
  const have = new Set(checked.contributions.map((c) => c.participantId));
  const missing = fallbackNaming(result).contributions.filter((c) => !have.has(c.participantId));
  return { ...checked, contributions: [...checked.contributions, ...missing], model: CLAUDE_MODEL };
}
