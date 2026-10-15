import { describe, expect, it } from 'vitest';
import type { BrockRescueRow } from '@/db/schema';
import { QUESTIONS } from '@/lib/trivia/questions';
import { isExpired, pickQuestion, rescueView, shuffledOptions } from '@/lib/trivia/rescue';

const asked = (over: Partial<BrockRescueRow> = {}): BrockRescueRow => ({
  brockId: 'b',
  streakBefore: 4,
  status: 'asked',
  questionId: QUESTIONS[0].id,
  options: ['a', 'b', 'c', 'd'],
  answerIndex: 2,
  chosenIndex: null,
  askedAt: new Date('2026-11-01T10:00:00Z'),
  answeredAt: null,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  ...over,
});

describe('pickQuestion', () => {
  it('skips questions already seen', () => {
    const seen = QUESTIONS.slice(1).map((q) => q.id);
    expect(pickQuestion(seen).id).toBe(QUESTIONS[0].id);
  });

  it('falls back to the whole bank once everything has been seen', () => {
    const all = QUESTIONS.map((q) => q.id);
    expect(QUESTIONS).toContain(pickQuestion(all));
  });
});

describe('shuffledOptions', () => {
  it('keeps all four options and points at the right answer, whatever the order', () => {
    for (const q of QUESTIONS.slice(0, 40)) {
      const { options, answerIndex } = shuffledOptions(q);
      expect([...options].sort()).toEqual([q.answer, ...q.wrong].sort());
      expect(options[answerIndex]).toBe(q.answer);
    }
  });

  it('puts the answer in every position over many shuffles', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 200; i++) positions.add(shuffledOptions(QUESTIONS[0]).answerIndex);
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe('rescueView', () => {
  it('hides the answer while the question is open', () => {
    const view = rescueView(asked(), new Date('2026-11-01T10:00:05Z'));
    expect(view).toMatchObject({
      status: 'asked',
      msLeft: 10_000,
      question: QUESTIONS[0].question,
    });
    expect(JSON.stringify(view)).not.toMatch(/answerIndex|correctIndex/);
  });

  it('reveals the answer once it is decided', () => {
    const view = rescueView(asked({ status: 'failed', chosenIndex: 1 }), new Date());
    expect(view).toMatchObject({ status: 'failed', correctIndex: 2, chosenIndex: 1 });
  });

  it('is null when there is no lifeline', () => {
    expect(rescueView(null, new Date())).toBeNull();
  });
});

describe('isExpired', () => {
  it('allows the 15 seconds plus a short grace for the network', () => {
    expect(isExpired(asked(), new Date('2026-11-01T10:00:16.500Z'))).toBe(false);
    expect(isExpired(asked(), new Date('2026-11-01T10:00:16.501Z'))).toBe(true);
  });

  it('only applies to an open question', () => {
    expect(isExpired(asked({ status: 'offered' }), new Date('2030-01-01T00:00:00Z'))).toBe(false);
  });
});
