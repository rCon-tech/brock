import { randomInt } from 'node:crypto';
import type { BrockRescueRow } from '@/db/schema';
import { QUESTIONS, type TriviaQuestion } from './questions';

/** Time allowed to answer, enforced on the server. */
export const RESCUE_SECONDS = 15;
/** Slack for the network round trip, so an answer tapped on time isn't rejected. */
export const RESCUE_GRACE_MS = 1500;

export type RescueView =
  | { status: 'offered'; streakBefore: number }
  | {
      status: 'asked';
      streakBefore: number;
      question: string;
      options: string[];
      /** Time left on the clock, for the countdown. */
      msLeft: number;
    }
  | {
      status: 'passed' | 'failed';
      streakBefore: number;
      question: string;
      options: string[];
      correctIndex: number;
      /** Null when the clock ran out. */
      chosenIndex: number | null;
    };

/** Picks a question the player hasn't seen; once they've seen them all, any question will do. */
export function pickQuestion(
  seenIds: Iterable<string>,
  bank: TriviaQuestion[] = QUESTIONS,
  rand: (n: number) => number = randomInt,
): TriviaQuestion {
  const seen = new Set(seenIds);
  const fresh = bank.filter((q) => !seen.has(q.id));
  const pool = fresh.length > 0 ? fresh : bank;
  return pool[rand(pool.length)];
}

/** The four options in a random order, and where the right answer landed. */
export function shuffledOptions(
  question: TriviaQuestion,
  rand: (n: number) => number = randomInt,
): { options: string[]; answerIndex: number } {
  const options = [question.answer, ...question.wrong];
  for (let i = options.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answerIndex: options.indexOf(question.answer) };
}

export function questionText(id: string | null): string {
  return QUESTIONS.find((q) => q.id === id)?.question ?? '';
}

export function deadline(row: Pick<BrockRescueRow, 'askedAt'>): number {
  return (row.askedAt?.getTime() ?? 0) + RESCUE_SECONDS * 1000;
}

/** True once the clock (plus grace) has run out on an asked question. */
export function isExpired(row: BrockRescueRow, now: Date): boolean {
  return row.status === 'asked' && now.getTime() > deadline(row) + RESCUE_GRACE_MS;
}

/** The client-safe view. While the question is open, the answer stays on the server. */
export function rescueView(row: BrockRescueRow | null, now: Date): RescueView | null {
  if (!row) return null;
  if (row.status === 'offered') return { status: 'offered', streakBefore: row.streakBefore };

  const question = questionText(row.questionId);
  const options = row.options ?? [];
  if (row.status === 'asked') {
    return {
      status: 'asked',
      streakBefore: row.streakBefore,
      question,
      options,
      msLeft: Math.max(0, deadline(row) - now.getTime()),
    };
  }
  return {
    status: row.status,
    streakBefore: row.streakBefore,
    question,
    options,
    correctIndex: row.answerIndex ?? -1,
    chosenIndex: row.chosenIndex,
  };
}
