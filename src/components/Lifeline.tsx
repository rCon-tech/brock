'use client';

import { useEffect, useRef, useState } from 'react';
import type { BrockStatus, TodayState } from '@/lib/brock-service';
import type { RescueView } from '@/lib/trivia/rescue';

interface Props {
  rescue: RescueView;
  brockStatus: BrockStatus;
  /** Called with the new state after the question is shown or answered. */
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

/** The trivia lifeline: offered after losing a streak, then the timed question, then the verdict. */
export function Lifeline({ rescue, brockStatus, onUpdate, onStale }: Props) {
  if (rescue.status === 'offered') {
    return <Offer streak={rescue.streakBefore} onUpdate={onUpdate} onStale={onStale} />;
  }
  if (rescue.status === 'asked') {
    return (
      <Question
        key={rescue.question}
        question={rescue.question}
        options={rescue.options}
        msLeft={rescue.msLeft}
        onUpdate={onUpdate}
        onStale={onStale}
      />
    );
  }
  if (rescue.status === 'failed') return <Verdict rescue={rescue} />;

  // Passed: either the second-chance Brock is still to play, or it has been played.
  if (brockStatus === 'pending') {
    return (
      <div className="panel flex w-full max-w-md flex-col items-center gap-2 px-4 pt-3 pb-4 text-center">
        <div className="stamp" data-outcome="win" data-testid="lifeline-verdict">
          CORRECT!
        </div>
        <p className="text-[15px]">
          Your streak of {rescue.streakBefore} is back. One more Brock: make it count!
        </p>
      </div>
    );
  }
  return brockStatus === 'won' ? <p className="caps text-xs">Saved by the lifeline!</p> : null;
}

function Offer({
  streak,
  onUpdate,
  onStale,
}: {
  streak: number;
  onUpdate: Props['onUpdate'];
  onStale: Props['onStale'];
}) {
  const [pending, setPending] = useState(false);

  async function take() {
    setPending(true);
    try {
      const res = await post('/api/brock/rescue/start', {});
      if (!res.ok) return onStale();
      onUpdate(await res.json());
    } catch {
      onStale();
    }
  }

  return (
    <div className="panel flex w-full max-w-md rotate-1 flex-col items-center gap-3 px-4 pt-4 pb-5 text-center">
      <div className="stamp" data-outcome="lifeline">
        LIFELINE!
      </div>
      <p className="text-[15px] leading-relaxed">
        You were on a streak of <strong>{streak}</strong>. Answer one tough trivia question in{' '}
        <strong>15 seconds</strong> and you get another Brock to keep it alive.
      </p>
      <button type="button" className="btn-ink" onClick={take} disabled={pending}>
        {pending ? 'HERE IT COMES…' : 'TAKE THE QUESTION'}
      </button>
    </div>
  );
}

function Question({
  question,
  options,
  msLeft,
  onUpdate,
  onStale,
}: {
  question: string;
  options: string[];
  msLeft: number;
  onUpdate: Props['onUpdate'];
  onStale: Props['onStale'];
}) {
  const [remaining, setRemaining] = useState(msLeft);
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
      const res = await post('/api/brock/rescue/answer', { choice });
      if (!res.ok) return onStale();
      onUpdate(await res.json());
    } catch {
      onStale();
    }
  }

  // Count down from the server's figure; when it hits zero, the clock answers for you.
  useEffect(() => {
    const deadline = Date.now() + msLeft;
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
  }, [msLeft]);

  useEffect(() => heading.current?.focus(), []);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = Math.min(1, remaining / 15_000);

  return (
    <div className="panel flex w-full max-w-md flex-col gap-3 p-4" data-testid="lifeline-question">
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
        {question}
      </h2>
      <div role="group" aria-label="Answers" className="flex flex-col gap-2">
        {options.map((option, i) => (
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

function Verdict({ rescue }: { rescue: Extract<RescueView, { correctIndex: number }> }) {
  const timedOut = rescue.chosenIndex === null;
  return (
    <div className="panel flex w-full max-w-md flex-col items-center gap-3 p-4 text-center">
      <div className="stamp" data-outcome="loss" data-testid="lifeline-verdict">
        {timedOut ? 'TIME’S UP!' : 'WRONG!'}
      </div>
      <p className="font-slab font-bold">{rescue.question}</p>
      <ul className="flex w-full flex-col gap-2 text-left">
        {rescue.options.map((option, i) => (
          <li
            key={option}
            className="option"
            data-state={
              i === rescue.correctIndex ? 'correct' : i === rescue.chosenIndex ? 'wrong' : undefined
            }
          >
            <span className="option-letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span>
              {option}
              {i === rescue.correctIndex && <span className="sr-only"> (correct answer)</span>}
              {i === rescue.chosenIndex && i !== rescue.correctIndex && (
                <span className="sr-only"> (your answer)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[15px]">Your streak of {rescue.streakBefore} is over.</p>
    </div>
  );
}
