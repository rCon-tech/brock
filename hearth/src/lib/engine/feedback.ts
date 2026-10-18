import type { Person, PersonSwipe } from './types';

export interface BoardSignals {
  reactions: { participantId: string; itemId: string; reaction: 'love' | 'unsure' | 'no' }[];
  swapsOut: { participantId: string; itemId: string }[];
}

/**
 * Turns reactions and swapped-out picks into extra swipes so the next recompute learns from them
 * (§11.3): ❤️ counts as a right swipe, ✕ and a swap-out as a left swipe, 🤔 as nothing.
 */
export function applyBoardSignals(people: Person[], signals: BoardSignals): Person[] {
  const extra = new Map<string, PersonSwipe[]>();
  const add = (participantId: string, itemId: string, value: 1 | -1) => {
    extra.set(participantId, [
      ...(extra.get(participantId) ?? []),
      { itemId, value, round: 'bridge' },
    ]);
  };
  for (const r of signals.reactions) {
    if (r.reaction === 'love') add(r.participantId, r.itemId, 1);
    if (r.reaction === 'no') add(r.participantId, r.itemId, -1);
  }
  for (const s of signals.swapsOut) add(s.participantId, s.itemId, -1);

  return people.map((p) => {
    const more = extra.get(p.id);
    if (!more) return p;
    const seen = new Map(p.swipes.map((s) => [s.itemId, s] as const));
    for (const m of more) seen.set(m.itemId, m);
    return { ...p, swipes: [...seen.values()] };
  });
}
