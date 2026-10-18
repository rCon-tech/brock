import { z } from 'zod';
import { EMBEDDING_DIM } from '@/lib/taxonomy';

export const VOYAGE_MODEL = 'voyage-multimodal-3';
const ENDPOINT = 'https://api.voyageai.com/v1/multimodalembeddings';
/** Voyage accepts batches; keep them small enough to stay well inside request limits. */
export const BATCH_SIZE = 32;

export interface EmbedInput {
  imageUrl: string;
  text: string;
}

/** The text sent with each image: its name, style and strongest tags, so text search lines up. */
export function embeddingText(item: {
  title: string;
  primaryStyle: string | null;
  attributes: string[];
}): string {
  const tags = item.attributes
    .filter((a) => !a.startsWith('practical:'))
    .slice(0, 6)
    .map((a) => a.split(':')[1].replace(/_/g, ' '));
  return [item.title, item.primaryStyle?.replace(/_/g, ' '), ...tags].filter(Boolean).join('. ');
}

export function buildRequest(inputs: EmbedInput[]) {
  return {
    model: VOYAGE_MODEL,
    input_type: 'document',
    inputs: inputs.map((i) => ({
      content: [
        { type: 'text', text: i.text },
        { type: 'image_url', image_url: i.imageUrl },
      ],
    })),
  };
}

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().optional() })),
});

/** Checks the vectors are the size the database expects before anything is stored. */
export function parseResponse(json: unknown, expected: number): number[][] {
  const parsed = responseSchema.parse(json);
  if (parsed.data.length !== expected)
    throw new Error(`Expected ${expected} embeddings, got ${parsed.data.length}`);
  for (const d of parsed.data) {
    if (d.embedding.length !== EMBEDDING_DIM) {
      throw new Error(
        `Expected ${EMBEDDING_DIM}-dimensional embeddings, got ${d.embedding.length}`,
      );
    }
  }
  return parsed.data.map((d) => d.embedding);
}

export async function embedItems(
  inputs: EmbedInput[],
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const res = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest(batch)),
    });
    if (!res.ok) throw new Error(`Voyage request failed: ${res.status} ${await res.text()}`);
    out.push(...parseResponse(await res.json(), batch.length));
  }
  return out;
}
