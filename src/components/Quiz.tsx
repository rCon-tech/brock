'use client';

import { useEffect, useRef, useState } from 'react';
import type { RunStatus, TodayState } from '@/lib/brock-service';
import { THROW_EMOJI } from '@/lib/game';
import type { QuizResult, QuizView } from '@/lib/trivia/quiz';

interface Props {
  quiz: QuizView | null;
  quizAvailable: boolean;
  status: RunStatus;
  score: number;
  /** Called with the new state after the quiz starts or a question is answered. */
  onUpdate: (state: TodayState) => void;
  /** Called when the server says our view is out of date. */
  onStale: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** "Win another life": the offer, five timed questions, then every answer revealed. */
export function Quiz({ quiz, quizAvailable, status, score, onUpdate, onStale }: Props) {
  if (!quiz) {
    return quizAvailable ? <Offer score={score} onUpdate={onUpdate} onStale={onStale} /> : null;
  }
  if (quiz.status === 'active') {
    return <Question key={quiz.index} quiz={quiz} onUpdate={onUpdate} onStale={onStale} />;
  }
  if (quiz.status === 'passed') {
    // While the revived run goes on, a banner is enough. Once it's over, say the life is spent.
    return status === 'playing' ? (
      <div className="panel flex w-full max-w-md flex-col items-center gap-2 px-4 pt-3 pb-4 text-center">
        <div className="stamp" data-outcome="win" data-testid="quiz-verdict">
          ANOTHER LIFE!
        </div>
        <p className="text-[15px]">
          5 out of 5! Your run carries on from <strong>{score}</strong>. Brock on!
        </p>
      </div>
    ) : (
      <p className="caps text-center text-xs">You’ve used today’s extra life.</p>
    );
  }
  return <Results quiz={quiz} />;
}

function Offer({
  score,
  onUpdate,
  onStale,
}: {
  score: number;
  onUpdate: Props['onUpdate'];
  onStale: Props['onStale'];
}) {
  const [pending, setPending] = useState(false);

  async function take() {
    setPending(true);
    try {
      const res = await post('/api/brock/quiz/start', {});
      if (!res.ok) return onStale();
      onUpdate(await res.json());
    } catch {
      onStale();
    }
  }

  return (
    <div className="panel flex w-full max-w-md rotate-1 flex-col items-center gap-3 px-4 pt-4 pb-5 text-center">
      <div className="stamp" data-outcome="lifeline">
        ONE MORE LIFE?
      </div>
      <p className="text-[15px] leading-relaxed">
        Answer <strong>5 quick questions</strong> on rocks, paper and scissors,{' '}
        <strong>15 seconds</strong> each. Get all 5 right and your run of <strong>{score}</strong>{' '}
        carries on. One try a day.
      </p>
      <button type="button" className="btn-ink" onClick={take} disabled={pending}>
        {pending ? 'HERE IT COMES…' : 'WIN ANOTHER LIFE'}
      </button>
    </div>
  );
}

function ThemeChip({ theme }: { theme: QuizResult['theme'] }) {
  return (
    <span className="theme-chip" data-theme-name={theme}>
      <span aria-hidden="true">{THROW_EMOJI[theme]} </span>
      {theme.toUpperCase()}
    </span>
  );
}

function Question({
  quiz,
  onUpdate,
  onStale,
}: {
  quiz: Extract<QuizView, { status: 'active' }>;
  onUpdate: Props['onUpdate'];
  onStale: Props['onStale'];
}) {
  const [remaining, setRemaining] = useState(quiz.msLeft);
  const [chosen, setChosen] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const sent = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  async function answer(choice: number | null) {
    if (sent.current) return;
    sent.current = true;
    setLocked(true);
    setChosen(choice);
    try {
      const res = await post('/api/brock/quiz/answer', { index: quiz.index, choice });
      if (!res.ok) return onStale();
      onUpdate(await res.json());
    } catch {
      onStale();
    }
  }

  // Count down from the server's figure; when it hits zero, the clock answers for you.
  useEffect(() => {
    const deadline = Date.now() + quiz.msLeft;
    const timer = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        void answer(null);
      }
    }, 100);
    return () => clearInterval(timer);
    // `answer` is stable enough for this one-shot timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.msLeft]);

  useEffect(() => heading.current?.focus(), []);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = Math.min(1, remaining / 15_000);

  return (
    <div className="panel flex w-full max-w-md flex-col gap-3 p-4" data-testid="quiz-question">
      <div className="flex items-center justify-between gap-3">
        <span className="caps text-xs">
          Question {quiz.index + 1} of {quiz.total}
        </span>
        <ThemeChip theme={quiz.theme} />
      </div>
      <div className="flex items-center gap-3">
        <span
          className="font-display text-4xl leading-none text-rust tabular-nums"
          aria-label={`${seconds} seconds left`}
        >
          {seconds}
        </span>
        <div className="h-4 flex-1 border-[3px] border-ink bg-paper" aria-hidden="true">
          <div
            className="h-full bg-rust transition-[width] duration-100 ease-linear"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-slab text-lg leading-snug font-bold outline-none"
      >
        {quiz.question}
      </h2>
      <div role="group" aria-label="Answers" className="flex flex-col gap-2">
        {quiz.options.map((option, i) => (
          <button
            key={option}
            type="button"
            className="option"
            data-state={chosen === i ? 'chosen' : undefined}
            disabled={locked}
            onClick={() => void answer(i)}
          >
            <span className="option-letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span>{option}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Results({ quiz }: { quiz: Exclude<QuizView, { status: 'active' }> }) {
  return (
    <div className="panel flex w-full max-w-md flex-col items-center gap-4 p-4 text-center">
      <div className="stamp" data-outcome="loss" data-testid="quiz-verdict">
        {quiz.correctCount} OUT OF {quiz.total}
      </div>
      <p className="text-[15px]">
        You need all {quiz.total} for another life, so today’s run is over. Here’s how you did:
      </p>
      <ol className="flex w-full flex-col gap-4 text-left">
        {quiz.results.map((r, n) => (
          <li key={r.question} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-slab font-bold">
                {n + 1}. {r.question}
              </p>
              <span aria-hidden="true" className="text-lg">
                {r.chosenIndex === r.correctIndex ? '✅' : '❌'}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {r.options.map((option, i) => (
                <li
                  key={option}
                  className="option py-1.5 text-sm"
                  data-state={
                    i === r.correctIndex ? 'correct' : i === r.chosenIndex ? 'wrong' : undefined
                  }
                >
                  <span className="option-letter" aria-hidden="true">
                    {LETTERS[i]}
                  </span>
                  <span>
                    {option}
                    {i === r.correctIndex && <span className="sr-only"> (correct answer)</span>}
                    {i === r.chosenIndex && i !== r.correctIndex && (
                      <span className="sr-only"> (your answer)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {r.chosenIndex === null && <p className="caps text-[11px] text-rust">Time ran out</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
