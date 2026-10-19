'use client';

import { useState } from 'react';
import {
  pickRandomMove,
  playTurn,
  startBattle,
  type BattleEvent,
  type BattleState,
  type Fighter,
  type Side,
} from '@/lib/ranemon/battle';
import { SPECIES, speciesById } from '@/lib/ranemon/species';

const YOU: Side = 0;
const LOG_LENGTH = 8;

function describe(event: BattleEvent, state: BattleState): string | null {
  const name = (side: Side) => `${side === YOU ? '' : 'Foe '}${state.fighters[side].species.name}`;
  switch (event.kind) {
    case 'move':
      return `${name(event.side)} used ${event.move.name}!`;
    case 'damage':
      if (event.effectiveness > 1) return `It's super effective! ${event.amount} damage.`;
      if (event.effectiveness < 1) return `It's not very effective… ${event.amount} damage.`;
      return `${event.amount} damage.`;
    case 'faint':
      return `${name(event.side)} fainted!`;
  }
}

function FighterCard({ fighter, label }: { fighter: Fighter; label: string }) {
  const { species, hp } = fighter;
  const pct = Math.round((hp / species.maxHp) * 100);
  const bar = pct > 50 ? 'bg-olive' : pct > 20 ? 'bg-sun' : 'bg-rust';
  return (
    <div className="panel flex flex-1 flex-col items-center gap-2 p-3">
      <span className="caps text-[11px]">{label}</span>
      <span className={`text-6xl ${hp === 0 ? 'opacity-30 grayscale' : ''}`} aria-hidden="true">
        {species.art}
      </span>
      <span className="font-display text-2xl tracking-wide">{species.name}</span>
      <span className="caps text-[11px]">{species.type} type</span>
      <div
        className="h-3 w-full border-2 border-ink bg-paper"
        role="meter"
        aria-label={`${species.name} HP`}
        aria-valuemin={0}
        aria-valuemax={species.maxHp}
        aria-valuenow={hp}
      >
        <div
          className={`h-full ${bar} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold">
        {hp} / {species.maxHp} HP
      </span>
    </div>
  );
}

export function RanemonBattle() {
  const [yourId, setYourId] = useState(SPECIES[0].id);
  const [foeId, setFoeId] = useState(SPECIES[2].id);
  const [state, setState] = useState<BattleState | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function begin() {
    setState(startBattle(speciesById(yourId), speciesById(foeId)));
    setLog([]);
  }

  function chooseMove(moveId: string) {
    if (!state) return;
    const foeMove = pickRandomMove(state.fighters[1], Math.random);
    const result = playTurn(state, [moveId, foeMove], Math.random);
    const lines = result.events.map((e) => describe(e, result.state)).filter((l) => l !== null);
    setState(result.state);
    setLog((prev) => [...lines.reverse(), ...prev].slice(0, LOG_LENGTH));
  }

  if (!state) {
    return (
      <div className="panel flex w-full flex-col gap-4 p-4">
        {(
          [
            ['Your Ranemon', yourId, setYourId],
            ['Opponent', foeId, setFoeId],
          ] as const
        ).map(([label, value, set]) => (
          <fieldset key={label} className="flex flex-col gap-2">
            <legend className="caps mb-1 text-xs">{label}</legend>
            <div className="grid grid-cols-3 gap-2">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn-paper flex flex-col items-center gap-1 px-1! text-[11px]! tracking-[0.04em]!"
                  aria-pressed={value === s.id}
                  onClick={() => set(s.id)}
                >
                  <span className="text-3xl" aria-hidden="true">
                    {s.art}
                  </span>
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="button" className="btn-ink self-center" onClick={begin}>
          BATTLE!
        </button>
      </div>
    );
  }

  const you = state.fighters[YOU];
  const over = state.winner !== null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex gap-3">
        <FighterCard fighter={you} label="You" />
        <FighterCard fighter={state.fighters[1]} label="Foe" />
      </div>

      {over ? (
        <div className="panel flex flex-col items-center gap-3 p-4 text-center">
          <p className="comic-heading text-4xl">{state.winner === YOU ? 'YOU WIN!' : 'YOU LOSE'}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ink" onClick={begin}>
              REMATCH
            </button>
            <button type="button" className="btn-paper" onClick={() => setState(null)}>
              Change Ranemon
            </button>
          </div>
        </div>
      ) : (
        <div role="group" aria-label="Choose a move" className="grid grid-cols-2 gap-2">
          {you.species.moves.map((m) => (
            <button
              key={m.id}
              type="button"
              className="btn-paper flex flex-col items-start gap-0.5 text-left"
              onClick={() => chooseMove(m.id)}
            >
              <span>{m.name}</span>
              <span className="text-[10px] opacity-70">
                {m.type} · power {m.power}
              </span>
            </button>
          ))}
        </div>
      )}

      <ol className="panel flex min-h-24 flex-col gap-1 p-3 text-sm" aria-live="polite">
        {log.length === 0 ? (
          <li className="opacity-60">Turn {state.turn}. Pick a move.</li>
        ) : (
          log.map((line, i) => (
            <li key={`${state.turn}-${i}`} className={i === 0 ? 'font-bold' : 'opacity-70'}>
              {line}
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
