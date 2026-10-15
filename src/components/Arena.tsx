'use client';

import { useEffect, useState } from 'react';
import type { RoundResult, Throw } from '@/lib/game';

export type ArenaMode = 'idle' | 'shaking' | 'revealed';

interface Props {
  mode: ArenaMode;
  /** The shapes shown once revealed. Both hands are fists before that. */
  player: Throw;
  house: Throw;
  /** From the player's side. */
  outcome: RoundResult | null;
  /** Show the end state without replaying the action, e.g. when coming back to a finished Brock. */
  still?: boolean;
}

const BEAT_MS = 400;
const WORDS = ['ROCK…', 'PAPER…', 'SCISSORS…'];

/** The three-beat call while both fists pump. Mounted fresh for each throw, so it starts at ROCK. */
function ShakeCall() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const timers = [1, 2].map((i) => setTimeout(() => setBeat(i), i * BEAT_MS));
    return () => timers.forEach(clearTimeout);
  }, []);
  const word = WORDS[beat];
  return (
    <div key={word} className="call" data-kind="beat" aria-hidden="true">
      {word}
    </div>
  );
}

function Side({
  side,
  label,
  shape,
  result,
}: {
  side: 'player' | 'house';
  label: string;
  shape: Throw;
  result?: 'win' | 'lose';
}) {
  return (
    <div className="arena-side" data-side={side} data-result={result}>
      <div className="hand-box">
        <svg className="burst" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <use href="#win-burst" />
        </svg>
        <svg className="hand" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
          <g className="pivot">
            <use href={`#hand-${shape}`} />
          </g>
        </svg>
      </div>
      <span className="side-label">{label}</span>
    </div>
  );
}

/** Your hand against the House's: idle fists, the pumping countdown, then the reveal. */
export function Arena({ mode, player, house, outcome, still }: Props) {
  const revealed = mode === 'revealed';
  const playerResult = !revealed
    ? undefined
    : outcome === 'win'
      ? 'win'
      : outcome === 'loss'
        ? 'lose'
        : undefined;
  const houseResult = !revealed
    ? undefined
    : outcome === 'loss'
      ? 'win'
      : outcome === 'win'
        ? 'lose'
        : undefined;

  return (
    <div className="arena" data-mode={mode} data-still={still ? '' : undefined}>
      <div className="arena-hands">
        <Side side="player" label="YOU" shape={revealed ? player : 'rock'} result={playerResult} />
        <Side
          side="house"
          label="THE HOUSE"
          shape={revealed ? house : 'rock'}
          result={houseResult}
        />
      </div>
      {mode === 'idle' && (
        <div className="call" aria-hidden="true">
          PICK ONE
        </div>
      )}
      {mode === 'shaking' && <ShakeCall />}
      {revealed && !still && (
        <div className="call" data-kind="brock" aria-hidden="true">
          BROCK!
        </div>
      )}
    </div>
  );
}
