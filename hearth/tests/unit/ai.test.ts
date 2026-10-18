import { describe, expect, it, vi } from 'vitest';
import { fallbackNaming } from '@/lib/ai/bridge-fallback';
import { bridgeNameFacts } from '@/lib/ai/prompts/bridge-name';
import { validateNaming, type BridgeNameOutput } from '@/lib/ai/schemas';
import { TAG_SYSTEM, parseTagResponse, tagRequest } from '@/lib/ai/tag-item';
import {
  BATCH_SIZE,
  buildRequest,
  embedItems,
  embeddingText,
  parseResponse,
} from '@/lib/embeddings/voyage';
import type { SynthesisResult } from '@/lib/engine/types';
import { EMBEDDING_DIM } from '@/lib/taxonomy';

const result: SynthesisResult = {
  participants: [
    { id: 'a', name: 'Rich' },
    { id: 'b', name: 'Sam' },
  ],
  solo: false,
  lead: 'bridge',
  bridgeStyle: 'warm_minimal',
  alreadyAgree: false,
  topStyles: { a: ['industrial', 'brutalist'], b: ['minimalist', 'japandi'] },
  lowConfidence: false,
  exactMicro: [],
  exactMacro: [],
  shared: [
    { attribute: 'line:clean_lines', evidence: {} },
    { attribute: 'material:metal_black', evidence: {} },
  ],
  conflicts: [{ attribute: 'material:velvet', lovedBy: ['a'], avoidedBy: ['b'] }],
  brings: { a: 'material:concrete', b: 'colour:cream' },
  picks: [],
  swapQueue: {},
  hybridRooms: [],
  vetoedAttributes: [],
  vetoedItemIds: [],
  palette: ['colour:charcoal', 'colour:cream'],
  materials: ['material:oak'],
  keeping: [{ category: 'sofa', label: 'grey sofa' }],
};

const good: BridgeNameOutput = {
  name: 'Warm Industrial',
  tagline: 'Soft edges, honest materials',
  rationale: 'Concrete and metal anchor the room while cream and oak keep it calm.',
  contributions: [
    { participantId: 'a', brings: 'Concrete and black metal' },
    { participantId: 'b', brings: 'Calm cream tones' },
  ],
};

describe('naming guard (R20)', () => {
  it('accepts clean wording', () => {
    expect(validateNaming(good, result)).toMatchObject({ name: 'Warm Industrial' });
  });

  it.each([
    ['a percentage', { rationale: 'You are 82% aligned on this look.' }],
    ['a score', { tagline: 'Your match score is high' }],
    ['winning', { rationale: 'Rich won this round with concrete.' }],
    ['compromise', { rationale: 'Sam had to compromise on cream.' }],
    [
      'giving way',
      {
        contributions: [{ participantId: 'a', brings: 'Gave in on colour' }, good.contributions[1]],
      },
    ],
    ['a long name', { name: 'The Very Warm Industrial Look' }],
    [
      'a long tagline',
      { tagline: 'one two three four five six seven eight nine ten eleven twelve thirteen' },
    ],
    ['a long rationale', { rationale: Array(61).fill('word').join(' ') }],
  ])('rejects %s', (_label, over) => {
    expect(validateNaming({ ...good, ...over } as BridgeNameOutput, result)).toBeNull();
  });

  it('drops contributions for people who are not in the room and rejects duplicates', () => {
    const out = validateNaming(
      {
        ...good,
        contributions: [...good.contributions, { participantId: 'ghost', brings: 'Invented' }],
      },
      result,
    );
    expect(out!.contributions.map((c) => c.participantId)).toEqual(['a', 'b']);
    expect(
      validateNaming(
        { ...good, contributions: [good.contributions[0], good.contributions[0]] },
        result,
      ),
    ).toBeNull();
  });

  it('gives the model only labels and first names, never scores or ids it could echo back', () => {
    const facts = JSON.stringify(bridgeNameFacts(result));
    expect(facts).toContain('Warm Minimal');
    expect(facts).toContain('clean lines');
    expect(facts).toContain('grey sofa');
    expect(facts).not.toMatch(/fit|score|picks|swapQueue|evidence/i);
  });
});

describe('fallback wording', () => {
  it('is plain, names the style, and passes its own guard', () => {
    const f = fallbackNaming(result);
    expect(f.name).toBe('Warm Minimal');
    expect(f.tagline).toContain('Rich and Sam');
    expect(f.rationale).toContain('clean lines');
    expect(f.contributions).toEqual([
      { participantId: 'a', brings: 'Brings concrete' },
      { participantId: 'b', brings: 'Brings cream' },
    ]);
    expect(
      validateNaming(
        {
          name: f.name,
          tagline: f.tagline,
          rationale: f.rationale,
          contributions: f.contributions,
        },
        result,
      ),
    ).not.toBeNull();
  });

  it('reads sensibly for one person and for people who already agree', () => {
    expect(
      fallbackNaming({ ...result, solo: true, participants: [result.participants[0]] }).tagline,
    ).toMatch(/your swipes/i);
    expect(fallbackNaming({ ...result, alreadyAgree: true }).tagline).toMatch(/eye to eye/i);
    expect(fallbackNaming({ ...result, bridgeStyle: null }).name).toBe('Your style');
  });
});

describe('tagging', () => {
  const valid = {
    primary_style: 'japandi',
    style_weights: [
      { style: 'japandi', weight: 1 },
      { style: 'minimalist', weight: 0.6 },
    ],
    attributes: ['material:oak', 'colour:beige', 'line:clean_lines'],
    room_types: ['living_room'],
    category: 'coffee_table',
    dimensions_cm: { width: 110, depth: 60, height: 42 },
    flags: [],
    summary: 'A low oak coffee table.',
  };

  it('accepts a well-formed answer', () => {
    expect(parseTagResponse(JSON.stringify(valid))).toMatchObject({
      primary_style: 'japandi',
      category: 'coffee_table',
    });
  });

  it.each([
    ['not json', 'oops'],
    ['an unknown style', JSON.stringify({ ...valid, primary_style: 'steampunk' })],
    ['an invented attribute', JSON.stringify({ ...valid, attributes: ['material:unobtainium'] })],
    ['no room types', JSON.stringify({ ...valid, room_types: [] })],
    ['an unknown flag', JSON.stringify({ ...valid, flags: ['spooky'] })],
  ])('rejects %s', (_l, text) => {
    expect(parseTagResponse(text)).toBeNull();
  });

  it('builds a cached batch request with the image and the right model and effort', () => {
    const req = tagRequest({
      id: 'x1',
      imageUrl: 'https://img.example/a.jpg',
      title: 'Oak table',
      description: 'Solid oak',
    });
    expect(req.custom_id).toBe('x1');
    expect(req.params.model).toBe('claude-opus-5-5');
    expect(req.params.output_config.effort).toBe('low');
    expect(req.params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(req.params.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://img.example/a.jpg' },
    });
    expect(TAG_SYSTEM).toContain('material: oak');
    expect(TAG_SYSTEM).toContain('japandi');
  });
});

describe('embeddings', () => {
  const vec = () => Array.from({ length: EMBEDDING_DIM }, () => 0.1);

  it('describes an item for embedding without the practical tags', () => {
    expect(
      embeddingText({
        title: 'Oak table',
        primaryStyle: 'warm_minimal',
        attributes: ['material:oak', 'practical:delicate', 'colour:beige'],
      }),
    ).toBe('Oak table. warm minimal. oak. beige');
  });

  it('builds one input per item with the image and text', () => {
    const req = buildRequest([{ imageUrl: 'https://img.example/a.jpg', text: 'Oak table' }]);
    expect(req.model).toBe('voyage-multimodal-3');
    expect(req.inputs[0].content).toEqual([
      { type: 'text', text: 'Oak table' },
      { type: 'image_url', image_url: 'https://img.example/a.jpg' },
    ]);
  });

  it('checks vector size and count before anything is stored', () => {
    expect(parseResponse({ data: [{ embedding: vec() }] }, 1)).toHaveLength(1);
    expect(() => parseResponse({ data: [{ embedding: [1, 2, 3] }] }, 1)).toThrow(/dimensional/);
    expect(() => parseResponse({ data: [] }, 1)).toThrow(/Expected 1/);
  });

  it('sends large sets in batches', async () => {
    const calls: number[] = [];
    const fetcher = vi.fn(async (_u: unknown, init: { body: string }) => {
      const n = JSON.parse(init.body).inputs.length as number;
      calls.push(n);
      return new Response(
        JSON.stringify({ data: Array.from({ length: n }, () => ({ embedding: vec() })) }),
      );
    });
    const inputs = Array.from({ length: BATCH_SIZE + 5 }, (_, i) => ({
      imageUrl: `https://i/${i}.jpg`,
      text: `t${i}`,
    }));
    const out = await embedItems(inputs, 'KEY', fetcher as unknown as typeof fetch);
    expect(out).toHaveLength(BATCH_SIZE + 5);
    expect(calls).toEqual([BATCH_SIZE, 5]);
    await expect(
      embedItems(
        inputs.slice(0, 1),
        'KEY',
        (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/401/);
  });
});
