import { describe, expect, it } from 'vitest';
import type { BrockQuizRow } from '@/db/schema';
import { QUESTIONS } from '@/lib/trivia/questions';
import { currentExpired, pickQuiz, quizView, toItems } from '@/lib/trivia/quiz';

describe('question bank', () => {
  it('has plenty of questions in every theme', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(120);
    for (const theme of ['rock', 'paper', 'scissors']) {
      expect(QUESTIONS.filter((q) => q.theme === theme).length, theme).toBeGreaterThanOrEqual(30);
    }
  });

  it('uses unique ids prefixed with their theme', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) expect(q.id.startsWith(`${q.theme}-`), q.id).toBe(true);
  });

  it('gives every question four distinct non-empty options and a real question', () => {
    for (const q of QUESTIONS) {
      const options = [q.answer, ...q.wrong].map((o) => o.trim().toLowerCase());
      expect(options.every(Boolean), q.id).toBe(true);
      expect(new Set(options).size, q.id).toBe(4);
      expect(q.question.trim().endsWith('?'), q.id).toBe(true);
    }
  });

  it('never repeats a question', () => {
    const texts = QUESTIONS.map((q) => q.question.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('pickQuiz', () => {
  it('picks five different questions covering all three themes', () => {
    for (let i = 0; i < 50; i++) {
      const quiz = pickQuiz([]);
      expect(quiz).toHaveLength(5);
      expect(new Set(quiz.map((q) => q.id)).size).toBe(5);
      expect(new Set(quiz.map((q) => q.theme))).toEqual(new Set(['rock', 'paper', 'scissors']));
    }
  });

  it('avoids questions already seen while unseen ones remain', () => {
    const fresh = new Set(
      ['rock', 'paper', 'scissors'].flatMap((t) =>
        QUESTIONS.filter((q) => q.theme === t)
          .slice(0, 5)
          .map((q) => q.id),
      ),
    );
    const seen = QUESTIONS.filter((q) => !fresh.has(q.id)).map((q) => q.id);
    for (let i = 0; i < 20; i++) {
      for (const q of pickQuiz(seen)) expect(fresh.has(q.id), q.id).toBe(true);
    }
  });

  it('still makes a full quiz once everything has been seen', () => {
    expect(pickQuiz(QUESTIONS.map((q) => q.id))).toHaveLength(5);
  });
});

describe('toItems', () => {
  it('shuffles options but always points at the right answer', () => {
    const items = toItems(QUESTIONS.slice(0, 40));
    items.forEach((item, i) => {
      expect(item.options[item.answerIndex]).toBe(QUESTIONS[i].answer);
      expect([...item.options].sort()).toEqual([QUESTIONS[i].answer, ...QUESTIONS[i].wrong].sort());
    });
  });
});

const row = (over: Partial<BrockQuizRow> = {}): BrockQuizRow => ({
  brockId: 'b',
  status: 'active',
  items: toItems(QUESTIONS.slice(0, 5)),
  currentIndex: 1,
  questionStartedAt: new Date('2026-11-01T10:00:00Z'),
  createdAt: new Date('2026-11-01T10:00:00Z'),
  finishedAt: null,
  ...over,
});

describe('quizView', () => {
  it('shows only the current question, with no answers, while active', () => {
    const view = quizView(row(), new Date('2026-11-01T10:00:04Z'));
    expect(view).toMatchObject({
      status: 'active',
      index: 1,
      total: 5,
      question: QUESTIONS[1].question,
      msLeft: 11_000,
    });
    expect(JSON.stringify(view)).not.toMatch(/answerIndex|correctIndex|chosenIndex|results/);
    expect(JSON.stringify(view)).not.toContain(QUESTIONS[0].question);
  });

  it('reveals every answer and the score once finished', () => {
    const items = toItems(QUESTIONS.slice(0, 5)).map((i, n) => ({
      ...i,
      chosenIndex: n < 3 ? i.answerIndex : null,
    }));
    const view = quizView(row({ status: 'failed', items, currentIndex: 5 }), new Date());
    expect(view).toMatchObject({ status: 'failed', total: 5, correctCount: 3 });
    if (view?.status === 'active' || !view) throw new Error();
    expect(view.results.map((r) => r.chosenIndex === r.correctIndex)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('is null before the quiz is taken', () => {
    expect(quizView(null, new Date())).toBeNull();
  });
});

describe('currentExpired', () => {
  it('allows 15 seconds per question plus a short grace', () => {
    expect(currentExpired(row(), new Date('2026-11-01T10:00:16.500Z'))).toBe(false);
    expect(currentExpired(row(), new Date('2026-11-01T10:00:16.501Z'))).toBe(true);
  });

  it('only applies while the quiz is running', () => {
    expect(currentExpired(row({ status: 'failed' }), new Date('2030-01-01'))).toBe(false);
  });
});
