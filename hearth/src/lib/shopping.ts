import { and, eq } from 'drizzle-orm';
import { catalogueItem, participant, project, shoppingListItem } from '@/db/schema';
import type { Db } from '@/db';
import { ROOM_BUDGET_PENCE } from '@/lib/budget';
import { AppError, NotFound } from '@/lib/errors';

/** "We bought this" (R25). */
export async function setBought(
  db: Db,
  participantId: string,
  itemId: string,
  bought: boolean,
): Promise<void> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  const updated = await db
    .update(shoppingListItem)
    .set(
      bought
        ? { boughtAt: new Date(), boughtByParticipantId: participantId }
        : { boughtAt: null, boughtByParticipantId: null },
    )
    .where(and(eq(shoppingListItem.projectId, me.projectId), eq(shoppingListItem.itemId, itemId)))
    .returning({ itemId: shoppingListItem.itemId });
  if (updated.length === 0) throw new AppError("That item isn't on your shopping list.");
}

/** Save a suggestion for later without needing anyone else to agree. */
export async function setSaved(
  db: Db,
  participantId: string,
  itemId: string,
  saved: boolean,
): Promise<void> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  if (saved) {
    await db
      .insert(shoppingListItem)
      .values({ projectId: me.projectId, itemId, source: 'saved' })
      .onConflictDoNothing();
  } else {
    await db
      .delete(shoppingListItem)
      .where(
        and(
          eq(shoppingListItem.projectId, me.projectId),
          eq(shoppingListItem.itemId, itemId),
          eq(shoppingListItem.source, 'saved'),
        ),
      );
  }
}

export interface ShoppingTotal {
  /** Sum of in-stock items on the list. */
  pence: number;
  /** The band's whole-room budget, or null for no band or no ceiling (R34). */
  budgetPence: number | null;
  itemCount: number;
}

export async function shoppingTotal(db: Db, projectId: string): Promise<ShoppingTotal> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  const rows = await db
    .select({ price: catalogueItem.pricePence, inStock: catalogueItem.inStock })
    .from(shoppingListItem)
    .innerJoin(catalogueItem, eq(catalogueItem.id, shoppingListItem.itemId))
    .where(eq(shoppingListItem.projectId, projectId));
  const counted = rows.filter((r) => r.inStock && r.price != null);
  return {
    pence: counted.reduce((s, r) => s + (r.price ?? 0), 0),
    budgetPence: proj.budgetBand ? ROOM_BUDGET_PENCE[proj.budgetBand] : null,
    itemCount: counted.length,
  };
}
