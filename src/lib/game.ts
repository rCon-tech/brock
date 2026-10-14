export const THROWS = ['rock', 'paper', 'scissors'] as const;

export type Throw = (typeof THROWS)[number];
export type RoundResult = 'win' | 'loss' | 'draw';

const BEATS: Record<Throw, Throw> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

export function isThrow(value: unknown): value is Throw {
  return typeof value === 'string' && (THROWS as readonly string[]).includes(value);
}

/** Result from the player's perspective: rock beats scissors, scissors beats paper, paper beats rock. */
export function resolveRound(player: Throw, house: Throw): RoundResult {
  if (player === house) return 'draw';
  return BEATS[player] === house ? 'win' : 'loss';
}

export const THROW_EMOJI: Record<Throw, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
};
