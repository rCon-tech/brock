'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { RevealedRound, TodayState } from '@/lib/brock-service';
import type { Throw } from '@/lib/game';
import { Arena, type ArenaMode } from './Arena';
import { Countdown } from './Countdown';
import { HandleForm } from './HandleForm';
import { RoundReveal } from './RoundReveal';
import { ShareButton } from './ShareButton';
import { StreakBadge } from './StreakBadge';
import { ThrowPicker } from './ThrowPicker';

type Phase = 'loading' | 'ready' | 'throwing' | 'drawn' | 'done' | 'error';

interface ArenaState {
  mode: ArenaMode;
  player: Throw;
  house: Throw;
  outcome: RevealedRound['result'] | null;
  still: boolean;
}

const IDLE: ArenaState = {
  mode: 'idle',
  player: 'rock',
  house: 'rock',
  outcome: null,
  still: false,
};

/** Errors that just mean "your view is out of date": reload the day and carry on. */
const STALE_ERRORS = ['stale_round', 'new_day', 'already_played', 'unauthorized'];
/** Three beats of "rock… paper… scissors…" while the server resolves the throw. */
const SUSPENSE_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function revealedArena(round: RevealedRound, still: boolean): ArenaState {
  return {
    mode: 'revealed',
    player: round.player,
    house: round.house,
    outcome: round.result,
    still,
  };
}

export function BrockGame() {
  const router = useRouter();
  const [state, setState] = useState<TodayState | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [arena, setArena] = useState<ArenaState>(IDLE);
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
      const final = data.rounds.at(-1);
      // Coming back to a finished Brock shows how it ended, without replaying the action.
      setArena(data.status !== 'pending' && final ? revealedArena(final, true) : IDLE);
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
    setArena({ ...IDLE, mode: 'shaking' });
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
      setArena(revealedArena(next.round, false));
      setPhase(next.status === 'pending' ? 'drawn' : 'done');
      setAnnounce(
        next.status === 'won'
          ? `You win! The House threw ${next.round.house}. Your streak is ${next.streak.current}.`
          : next.status === 'lost'
            ? `The House wins with ${next.round.house}. Your streak is reset.`
            : `It’s a tie. The House threw ${next.round.house} too. Brock again.`,
      );
    } catch {
      // The request may have landed even though we didn't hear back, so resync with the server.
      setMessage('Something went wrong. Please try again.');
      await load();
    }
  }

  function brockAgain() {
    setArena(IDLE);
    setPhase('ready');
  }

  if (phase === 'loading' || !state) {
    return phase === 'error' ? (
      <ErrorPanel message={message} onRetry={() => void load()} />
    ) : (
      <p className="caps py-12 text-center text-sm" role="status">
        Loading today’s Brock…
      </p>
    );
  }

  const finalRound = state.rounds.at(-1) ?? null;

  return (
    <section className="flex w-full flex-col items-center gap-5" aria-label="Today’s Brock">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <StreakBadge current={state.streak.current} best={state.streak.best} />

      {state.rounds.length === 0 && state.handle === null && phase === 'ready' && (
        <p className="panel max-w-[46ch] -rotate-1 px-4 py-3 text-center text-[15px] leading-relaxed">
          One rock paper scissors a day against the House. Win and your streak grows. Lose, or skip
          a day, and it resets. No sign-up: just play.{' '}
          <Link href="/login" className="font-bold text-rust underline underline-offset-2">
            Played before? Log in
          </Link>
        </p>
      )}

      {message && (
        <p role="alert" className="panel px-4 py-2 text-sm text-rust">
          {message}
        </p>
      )}

      {phase === 'error' && <ErrorPanel message={message} onRetry={() => void load()} />}

      <Arena {...arena} />

      {phase === 'ready' && state.openRound && (
        <>
          <HouseCommit hash={state.openRound.commitHash} round={state.openRound.roundNo} />
          <ThrowPicker onPick={onPick} />
        </>
      )}

      {phase === 'throwing' && (
        <>
          <p className="sr-only" role="status">
            Throwing {picked}…
          </p>
          <ThrowPicker onPick={onPick} disabled />
        </>
      )}

      {phase === 'drawn' && lastRound && (
        <>
          <RoundReveal round={lastRound} streak={state.streak.current} />
          <button type="button" onClick={brockAgain} className="btn-ink">
            BROCK
          </button>
        </>
      )}

      {phase === 'done' && finalRound && (
        <>
          <RoundReveal round={finalRound} streak={state.streak.current} />
          {state.handle === null && (
            <div className="panel w-full max-w-md p-4">
              <HandleForm
                onNamed={() => {
                  router.refresh();
                  void load();
                }}
              />
            </div>
          )}
          <div className="panel flex w-full max-w-md -rotate-1 flex-col items-center gap-2 px-4 pt-3 pb-4 text-center">
            <p className="font-display text-2xl leading-tight tracking-wide text-rust">
              See you tomorrow!
            </p>
            <p className="text-[15px]">
              {state.status === 'won'
                ? 'Come back tomorrow to keep your streak going.'
                : 'Come back tomorrow to start a new streak.'}
            </p>
            <Countdown msUntilReset={state.msUntilReset} onZero={() => void load()} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <ShareButton state={state} />
            <Link href="/leaderboard" className="caps text-xs underline underline-offset-4">
              See the leaderboard
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function HouseCommit({ hash, round }: { hash: string; round: number }) {
  return (
    <p className="text-center text-[15px]">
      {round > 1 ? 'The House chose again.' : 'The House has chosen.'} Its throw is locked in.{' '}
      <span title={hash} className="font-mono text-xs whitespace-nowrap opacity-70">
        🔒 {hash.slice(0, 12)}…
      </span>
      <span className="sr-only"> Commitment hash {hash}.</span>
    </p>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel flex w-full max-w-md flex-col items-center gap-3 p-6 text-center">
      <p>{message || 'Something went wrong.'}</p>
      <button type="button" onClick={onRetry} className="btn-ink">
        TRY AGAIN
      </button>
    </div>
  );
}
