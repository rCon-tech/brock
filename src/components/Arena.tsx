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
  /** The player's armour tier (0 to 4), earned every 2 wins in today's run. Cosmetic only. */
  armor?: number;
  /** The armour tier just went up with this round: say so. */
  upgraded?: boolean;
}

export const ARMOR_NAMES = ['', 'BRONZE', 'STEEL', 'GOLD', 'LEGENDARY'] as const;

/** One armour tier per 2 wins in the run, up to 4 (at 8 wins). Weapons come from tier 2. */
export function armorTier(score: number): number {
  return Math.min(4, Math.floor(score / 2));
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
  armor = 0,
}: {
  side: 'player' | 'house';
  label: string;
  shape: Throw;
  result?: 'win' | 'lose';
  armor?: number;
}) {
  return (
    <div
      className="arena-side"
      data-side={side}
      data-result={result}
      data-armor={armor || undefined}
      data-testid={`${side}-side`}
    >
      <div className="hand-box">
        <svg className="burst" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <use href="#win-burst" />
        </svg>
        <svg className="hand" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
          <g className="pivot">
            {armor >= 2 && <use href={`#armor-back-${armor}`} />}
            <use href={`#hand-${shape}`} />
            {armor > 0 && <use href={`#armor-${armor}`} />}
          </g>
        </svg>
      </div>
      <span className="side-label">{label}</span>
    </div>
  );
}

/** Your hand against the House's: idle fists, the pumping countdown, then the reveal. */
export function Arena({ mode, player, house, outcome, still, armor = 0, upgraded }: Props) {
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
        <Side
          side="player"
          label="YOU"
          shape={revealed ? player : 'rock'}
          result={playerResult}
          armor={armor}
        />
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
      {revealed && !still && upgraded && armor > 0 && (
        <div className="call" data-kind="upgrade" aria-hidden="true">
          {ARMOR_NAMES[armor]} ARMOUR!
        </div>
      )}
    </div>
  );
}
