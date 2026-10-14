'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { RevealedRound, TodayState } from '@/lib/brock-service';
import { THROW_EMOJI, type Throw } from '@/lib/game';
import { Countdown } from './Countdown';
import { RoundReveal } from './RoundReveal';
import { ShareButton } from './ShareButton';
import { StreakBadge } from './StreakBadge';
import { ThrowPicker } from './ThrowPicker';

type Phase = 'loading' | 'ready' | 'throwing' | 'drawn' | 'done' | 'error';

/** Errors that just mean "your view is out of date": reload the day and carry on. */
const STALE_ERRORS = ['stale_round', 'new_day', 'already_played'];
const SUSPENSE_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function BrockGame() {
  const [state, setState] = useState<TodayState | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [lastRound, setLastRound] = useState<RevealedRound | null>(null);
  const [picked, setPicked] = useState<Throw | null>(null);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/brock/today', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data: TodayState = await res.json();
      setState(data);
      setLastRound(null);
      setPhase(data.status === 'pending' ? 'ready' : 'done');
    } catch {
      setMessage('Couldn’t load today’s Brock.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; `load` only sets state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onPick(choice: Throw) {
    if (!state?.openRound) return;
    setPicked(choice);
    setPhase('throwing');
    setMessage('');

    try {
      const [res] = await Promise.all([
        fetch('/api/brock/throw', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roundNo: state.openRound.roundNo, throw: choice }),
        }),
        sleep(SUSPENSE_MS),
      ]);
      const data = await res.json();

      if (!res.ok) {
        if (STALE_ERRORS.includes(data.error)) return void (await load());
        throw new Error(data.error);
      }

      const next = data as TodayState & { round: RevealedRound };
      setLastRound(next.round);
      setState(next);
      setPhase(next.status === 'pending' ? 'drawn' : 'done');
      setAnnounce(
        next.status === 'won'
          ? `You win! Your streak is ${next.streak.current}.`
          : next.status === 'lost'
            ? 'You lose. Your streak is reset.'
            : `It’s a draw. The House threw ${next.round.house}. Throw again.`,
      );
    } catch {
      // The request may have landed even though we didn't hear back, so resync with the server.
      setMessage('Something went wrong. Please try again.');
      await load();
    }
  }

  if (phase === 'loading' || !state) {
    return phase === 'error' ? (
      <ErrorPanel message={message} onRetry={() => void load()} />
    ) : (
      <p className="py-12 text-center text-brock-muted" role="status">
        Loading today’s Brock…
      </p>
    );
  }

  const decided = state.status !== 'pending';
  const finalRound = state.rounds.at(-1) ?? null;

  return (
    <section className="flex flex-col gap-5" aria-labelledby="brock-title">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="brock-title" className="text-3xl font-extrabold">
          Brock #{state.brockNumber}
        </h1>
        <StreakBadge current={state.streak.current} best={state.streak.best} />
      </div>

      {message && (
        <p role="alert" className="rounded-xl border border-brock-loss/40 p-3 text-sm text-brock-loss">
          {message}
        </p>
      )}

      {phase === 'error' && <ErrorPanel message={message} onRetry={() => void load()} />}

      {phase === 'ready' && state.openRound && (
        <>
          <HouseCommit hash={state.openRound.commitHash} round={state.openRound.roundNo} />
          <ThrowPicker onPick={onPick} />
        </>
      )}

      {phase === 'throwing' && (
        <div
          className="flex items-center justify-center gap-10 rounded-2xl border border-brock-line bg-brock-card py-10 text-7xl"
          role="status"
          aria-label="Throwing"
        >
          <span className="brock-shake" aria-hidden>
            🪨
          </span>
          <span className="brock-shake" aria-hidden>
            🪨
          </span>
          <span className="sr-only">Throwing {picked}…</span>
        </div>
      )}

      {phase === 'drawn' && lastRound && (
        <>
          <RoundReveal round={lastRound} />
          <button
            type="button"
            onClick={() => setPhase('ready')}
            className="rounded-xl bg-brock-accent px-4 py-3 text-base font-bold text-black transition hover:brightness-110"
          >
            Throw again
          </button>
        </>
      )}

      {phase === 'done' && decided && finalRound && (
        <>
          <RoundReveal round={finalRound} />
          <div className="rounded-2xl border border-brock-line bg-brock-card p-5">
            <p className="text-xl font-extrabold">
              {state.status === 'won'
                ? `Brocked! Streak: 🔥 ${state.streak.current}`
                : 'Streak over. Back to 0.'}
            </p>
            <p className="mt-1 text-sm text-brock-muted" aria-label="Your throws against the House">
              {state.rounds.map((r) => `${THROW_EMOJI[r.player]}→${THROW_EMOJI[r.house]}`).join('  ')}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <ShareButton state={state} />
              <Countdown msUntilReset={state.msUntilReset} onZero={() => void load()} />
              <Link href="/leaderboard" className="text-sm font-semibold text-brock-accent hover:underline">
                See the leaderboard →
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function HouseCommit({ hash, round }: { hash: string; round: number }) {
  return (
    <p className="rounded-xl border border-brock-line bg-brock-card p-4 text-center">
      <span className="font-semibold">
        {round > 1 ? 'The House chose again.' : 'The House has chosen.'}
      </span>{' '}
      <span title={hash} className="font-mono text-sm text-brock-muted">
        🔒 {hash.slice(0, 12)}…
      </span>
      <span className="sr-only"> Commitment hash {hash}.</span>
    </p>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-brock-line bg-brock-card p-6 text-center">
      <p className="text-brock-muted">{message || 'Something went wrong.'}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl bg-brock-accent px-4 py-2 font-bold text-black"
      >
        Try again
      </button>
    </div>
  );
}
