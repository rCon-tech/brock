import { randomInt } from 'node:crypto';
import type { BrockQuizRow, QuizItem } from '@/db/schema';
import { QUESTIONS, type Theme, type TriviaQuestion } from './questions';

/** Questions per quiz; all must be right to win a life. */
export const QUIZ_LENGTH = 5;
/** Time allowed per question, enforced on the server. */
export const QUESTION_SECONDS = 15;
/** Slack for the network round trip, so an answer tapped on time isn't rejected. */
export const QUIZ_GRACE_MS = 1500;

const THEMES: Theme[] = ['rock', 'paper', 'scissors'];
type Rand = (n: number) => number;

export interface QuizResult {
  theme: Theme;
  question: string;
  options: string[];
  correctIndex: number;
  /** Null when the clock ran out. */
  chosenIndex: number | null;
}

export type QuizView =
  | {
      status: 'active';
      /** 0-based index of the question on screen. */
      index: number;
      total: number;
      theme: Theme;
      question: string;
      options: string[];
      /** Time left on this question's clock. */
      msLeft: number;
    }
  | {
      status: 'passed' | 'failed';
      total: number;
      correctCount: number;
      results: QuizResult[];
    };

function shuffle<T>(items: T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Five questions covering all three themes (plus two more at random), preferring ones the player
 * hasn't seen. Once a theme's unseen questions run out, its seen ones come back into play.
 */
export function pickQuiz(
  seenIds: Iterable<string>,
  bank: TriviaQuestion[] = QUESTIONS,
  rand: Rand = randomInt,
): TriviaQuestion[] {
  const seen = new Set(seenIds);
  const themes = shuffle([...THEMES, THEMES[rand(3)], THEMES[rand(3)]], rand);
  const chosen: TriviaQuestion[] = [];
  for (const theme of themes) {
    const unused = bank.filter((q) => q.theme === theme && !chosen.includes(q));
    const fresh = unused.filter((q) => !seen.has(q.id));
    const pool = fresh.length > 0 ? fresh : unused;
    if (pool.length > 0) chosen.push(pool[rand(pool.length)]);
  }
  // Tiny banks only: top up from anything left.
  while (chosen.length < QUIZ_LENGTH) {
    const rest = bank.filter((q) => !chosen.includes(q));
    if (rest.length === 0) break;
    chosen.push(rest[rand(rest.length)]);
  }
  return chosen;
}

/** Each question with its options shuffled, and where the right answer landed. */
export function toItems(questions: TriviaQuestion[], rand: Rand = randomInt): QuizItem[] {
  return questions.map((q) => {
    const options = shuffle([q.answer, ...q.wrong], rand);
    return { questionId: q.id, options, answerIndex: options.indexOf(q.answer) };
  });
}

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export function questionFor(id: string): TriviaQuestion | undefined {
  return byId.get(id);
}

export function questionDeadline(row: Pick<BrockQuizRow, 'questionStartedAt'>): number {
  return row.questionStartedAt.getTime() + QUESTION_SECONDS * 1000;
}

/** True once the current question's clock (plus grace) has run out. */
export function currentExpired(row: BrockQuizRow, now: Date): boolean {
  return row.status === 'active' && now.getTime() > questionDeadline(row) + QUIZ_GRACE_MS;
}

export function correctCount(items: QuizItem[]): number {
  return items.filter((i) => i.chosenIndex === i.answerIndex).length;
}

/** The client-safe view. While the quiz runs, no answers (or right/wrong) leave the server. */
export function quizView(row: BrockQuizRow | null, now: Date): QuizView | null {
  if (!row) return null;
  if (row.status === 'active') {
    const item = row.items[row.currentIndex];
    const q = questionFor(item.questionId);
    return {
      status: 'active',
      index: row.currentIndex,
      total: row.items.length,
      theme: q?.theme ?? 'rock',
      question: q?.question ?? '',
      options: item.options,
      msLeft: Math.max(0, questionDeadline(row) - now.getTime()),
    };
  }
  return {
    status: row.status,
    total: row.items.length,
    correctCount: correctCount(row.items),
    results: row.items.map((item) => {
      const q = questionFor(item.questionId);
      return {
        theme: q?.theme ?? 'rock',
        question: q?.question ?? '',
        options: item.options,
        correctIndex: item.answerIndex,
        chosenIndex: item.chosenIndex ?? null,
      };
    }),
  };
}
