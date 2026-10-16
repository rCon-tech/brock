import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '@/lib/trivia/questions';

describe('trivia question bank', () => {
  it('has plenty of questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(140);
  });

  it('uses unique, slug-style ids', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('gives every question four distinct, non-empty options with one answer', () => {
    for (const q of QUESTIONS) {
      const options = [q.answer, ...q.wrong].map((o) => o.trim().toLowerCase());
      expect(
        options.every((o) => o.length > 0),
        q.id,
      ).toBe(true);
      expect(new Set(options).size, q.id).toBe(4);
    }
  });

  it('asks a real question each time', () => {
    for (const q of QUESTIONS) {
      expect(q.question.trim().endsWith('?'), q.id).toBe(true);
    }
  });

  it('never repeats the same question text', () => {
    const texts = QUESTIONS.map((q) => q.question.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
});
