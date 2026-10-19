import type { Move, Species } from './battle';

const TACKLE: Move = { id: 'tackle', name: 'Tackle', type: 'normal', power: 40 };

/** Placeholder roster: emoji stand in for art until there are real sprites. */
export const SPECIES: Species[] = [
  {
    id: 'boulderon',
    name: 'Boulderon',
    type: 'rock',
    art: '🪨',
    maxHp: 110,
    attack: 55,
    defense: 65,
    speed: 30,
    moves: [
      TACKLE,
      { id: 'rockslide', name: 'Rockslide', type: 'rock', power: 75 },
      { id: 'pebble-shot', name: 'Pebble Shot', type: 'rock', power: 45 },
      { id: 'paper-cut', name: 'Paper Cut', type: 'paper', power: 50 },
    ],
  },
  {
    id: 'origamew',
    name: 'Origamew',
    type: 'paper',
    art: '📄',
    maxHp: 90,
    attack: 50,
    defense: 50,
    speed: 55,
    moves: [
      TACKLE,
      { id: 'wrap', name: 'Wrap', type: 'paper', power: 70 },
      { id: 'paper-plane', name: 'Paper Plane', type: 'paper', power: 50 },
      { id: 'snip', name: 'Snip', type: 'scissors', power: 50 },
    ],
  },
  {
    id: 'snipsnap',
    name: 'Snipsnap',
    type: 'scissors',
    art: '✂️',
    maxHp: 80,
    attack: 65,
    defense: 40,
    speed: 70,
    moves: [
      TACKLE,
      { id: 'shear', name: 'Shear', type: 'scissors', power: 70 },
      { id: 'double-snip', name: 'Double Snip', type: 'scissors', power: 45 },
      { id: 'stone-toss', name: 'Stone Toss', type: 'rock', power: 50 },
    ],
  },
];

export function speciesById(id: string): Species {
  const species = SPECIES.find((s) => s.id === id);
  if (!species) throw new Error(`No Ranemon called ${id}`);
  return species;
}
