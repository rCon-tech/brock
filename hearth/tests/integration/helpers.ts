import { getDb, type Db } from '@/db';
import { user } from '@/db/schema';
import { newId } from '@/lib/ids';
import { seedCatalogue } from '@/lib/seed/load';
import { getDeckState, finishRound, recordSwipes } from '@/lib/swipes';
import { loadItemCards } from '@/lib/catalogue/load';
import type { ItemCard } from '@/lib/catalogue/load';

const TEST_STYLES = [
  'industrial',
  'minimalist',
  'warm_minimal',
  'japandi',
  'scandinavian',
  'contemporary',
  'brutalist',
  'boho',
  'mid_century',
  'rustic',
] as const;

/** A fresh in-memory database with a small synthetic living-room catalogue. */
export async function freshDb(): Promise<Db> {
  const db = await getDb();
  await seedCatalogue(db, {
    styles: TEST_STYLES,
    roomTypes: ['living_room'],
    macroPerStyle: 2,
    microPerCategoryPerStyle: 1,
  });
  return db;
}

export async function makeUser(db: Db, name = 'Guest'): Promise<string> {
  const id = newId();
  await db.insert(user).values({
    id,
    name,
    email: `${id}@guest.hearth.test`,
    isAnonymous: true,
  });
  return id;
}

export const INDUSTRIAL = ['industrial', 'brutalist', 'contemporary'];
export const MINIMAL = ['minimalist', 'japandi', 'scandinavian'];

/** Swipes the whole deck for a participant, right on cards for which `likes` is true. */
export async function swipeDeck(
  db: Db,
  participantId: string,
  likes: (card: ItemCard) => boolean,
  opts: { finish?: boolean } = {},
): Promise<void> {
  const state = await getDeckState(db, participantId);
  const cards = await loadItemCards(db, [...state.remainingMacro, ...state.remainingMicro]);
  const mk = (itemId: string, round: 'macro' | 'micro') => ({
    clientId: `${participantId}-${itemId}`.padEnd(8, 'x').slice(0, 60),
    itemId,
    round,
    value: likes(cards.get(itemId)!) ? (1 as const) : (-1 as const),
  });
  await recordSwipes(db, participantId, [
    ...state.remainingMacro.map((id) => mk(id, 'macro')),
    ...state.remainingMicro.map((id) => mk(id, 'micro')),
  ]);
  if (opts.finish !== false) {
    await finishRound(db, participantId, 'macro');
    await finishRound(db, participantId, 'micro');
  }
}

export const styleCard =
  (...styles: string[]) =>
  (c: ItemCard) =>
    styles.includes(c.primaryStyle ?? '');
