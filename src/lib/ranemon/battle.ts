/**
 * Ranemon battle prototype: two creatures trade moves until one faints.
 * Pure and deterministic given `rng`, so it runs the same in tests and in the browser.
 */

export const TYPES = ['rock', 'paper', 'scissors', 'normal'] as const;
export type RaneType = (typeof TYPES)[number];

/** Rock blunts scissors, scissors cut paper, paper wraps rock. Normal is neutral both ways. */
const STRONG_AGAINST: Partial<Record<RaneType, RaneType>> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

/** 2 when the move's type beats the defender's, 0.5 when it is beaten by it, else 1. */
export function effectiveness(move: RaneType, defender: RaneType): number {
  if (STRONG_AGAINST[move] === defender) return 2;
  if (STRONG_AGAINST[defender] === move) return 0.5;
  return 1;
}

export interface Move {
  id: string;
  name: string;
  type: RaneType;
  power: number;
}

export interface Species {
  id: string;
  name: string;
  type: RaneType;
  art: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: Move[];
}

export interface Fighter {
  species: Species;
  hp: number;
}

export type Side = 0 | 1;

export type BattleEvent =
  | { kind: 'move'; side: Side; move: Move }
  | { kind: 'damage'; side: Side; amount: number; effectiveness: number; hpLeft: number }
  | { kind: 'faint'; side: Side };

export interface BattleState {
  fighters: [Fighter, Fighter];
  turn: number;
  winner: Side | null;
}

/** Returns a float in [0, 1). Math.random fits; tests pass a fixed sequence. */
export type Rng = () => number;

export function startBattle(a: Species, b: Species): BattleState {
  return {
    fighters: [
      { species: a, hp: a.maxHp },
      { species: b, hp: b.maxHp },
    ],
    turn: 1,
    winner: null,
  };
}

/**
 * Damage for one hit. Moves matching the attacker's own type get a 1.5x bonus, and a roll
 * in [0.85, 1] keeps hits from being identical. Every landed hit does at least 1.
 */
export function damage(attacker: Species, defender: Species, move: Move, roll: number): number {
  const base = (move.power * attacker.attack) / defender.defense / 5 + 2;
  const sameType = move.type === attacker.type ? 1.5 : 1;
  const spread = 0.85 + 0.15 * roll;
  return Math.max(
    1,
    Math.floor(base * sameType * effectiveness(move.type, defender.type) * spread),
  );
}

/** The faster creature moves first; speed ties are a coin flip. */
export function turnOrder(state: BattleState, rng: Rng): [Side, Side] {
  const [a, b] = state.fighters;
  if (a.species.speed !== b.species.speed)
    return a.species.speed > b.species.speed ? [0, 1] : [1, 0];
  return rng() < 0.5 ? [0, 1] : [1, 0];
}

/** Plays one turn where each side uses its chosen move. A creature that faints doesn't get to act. */
export function playTurn(
  state: BattleState,
  moveIds: [string, string],
  rng: Rng,
): { state: BattleState; events: BattleEvent[] } {
  if (state.winner !== null) throw new Error('The battle is already over');

  const fighters: [Fighter, Fighter] = [{ ...state.fighters[0] }, { ...state.fighters[1] }];
  const moves = fighters.map((f, i) => {
    const move = f.species.moves.find((m) => m.id === moveIds[i]);
    if (!move) throw new Error(`${f.species.name} doesn't know ${moveIds[i]}`);
    return move;
  });

  const events: BattleEvent[] = [];
  let winner: Side | null = null;

  for (const side of turnOrder(state, rng)) {
    if (winner !== null) break;
    const target: Side = side === 0 ? 1 : 0;
    const move = moves[side];
    const amount = damage(fighters[side].species, fighters[target].species, move, rng());
    fighters[target].hp = Math.max(0, fighters[target].hp - amount);
    events.push({ kind: 'move', side, move });
    events.push({
      kind: 'damage',
      side: target,
      amount,
      effectiveness: effectiveness(move.type, fighters[target].species.type),
      hpLeft: fighters[target].hp,
    });
    if (fighters[target].hp === 0) {
      events.push({ kind: 'faint', side: target });
      winner = side;
    }
  }

  return { state: { fighters, turn: state.turn + 1, winner }, events };
}

/** The opponent's AI for now: any move it knows, at random. */
export function pickRandomMove(fighter: Fighter, rng: Rng): string {
  const { moves } = fighter.species;
  return moves[Math.floor(rng() * moves.length)].id;
}
