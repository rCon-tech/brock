import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { comment, habitat, membership, reaction, record, user } from '@/db/schema';
import { conflict } from './errors';
import { reevaluateOpen } from './proposals';

/** Everything this person has put into Habitat, as JSON they can keep. */
export async function exportMyData(userId: string) {
  const db = getDb();
  const [me] = await db.select().from(user).where(eq(user.id, userId));
  const habitats = await db
    .select({
      id: habitat.id,
      name: habitat.name,
      role: membership.role,
      nickname: membership.nickname,
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
    })
    .from(membership)
    .innerJoin(habitat, eq(habitat.id, membership.habitatId))
    .where(eq(membership.userId, userId));
  const records = await db
    .select({
      id: record.id,
      habitatId: record.habitatId,
      module: record.moduleId,
      collection: record.collection,
      parentId: record.parentId,
      data: record.data,
      createdAt: record.createdAt,
    })
    .from(record)
    .where(and(eq(record.authorId, userId), isNull(record.deletedAt)));
  const comments = await db
    .select({
      id: comment.id,
      habitatId: comment.habitatId,
      recordId: comment.recordId,
      body: comment.body,
      createdAt: comment.createdAt,
    })
    .from(comment)
    .where(and(eq(comment.authorId, userId), isNull(comment.deletedAt)));
  const reactions = await db
    .select({ recordId: reaction.recordId, emoji: reaction.emoji, createdAt: reaction.createdAt })
    .from(reaction)
    .where(eq(reaction.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: me
      ? { id: me.id, name: me.name, email: me.email, image: me.image, createdAt: me.createdAt }
      : null,
    habitats,
    records,
    comments,
    reactions,
  };
}

/**
 * Delete the account. Habitats you own with other people in them must be handed over first.
 * Content is credited to "former member" (H13), or removed too with `deleteContent`.
 */
export async function deleteAccount(
  userId: string,
  opts: { deleteContent?: boolean } = {},
  now = new Date(),
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const mine = await tx
      .select()
      .from(membership)
      .where(and(eq(membership.userId, userId), isNull(membership.leftAt)));
    for (const m of mine) {
      if (m.role !== 'owner') continue;
      const others = await tx
        .select({ id: membership.userId })
        .from(membership)
        .where(and(eq(membership.habitatId, m.habitatId), isNull(membership.leftAt)));
      if (others.length > 1) {
        throw conflict(
          'owns_habitat',
          'You own a Habitat that other people are in. Hand it over to someone first.',
        );
      }
      await tx.update(habitat).set({ deletedAt: now }).where(eq(habitat.id, m.habitatId));
    }
    if (opts.deleteContent) {
      await tx
        .update(record)
        .set({ deletedAt: now })
        .where(and(eq(record.authorId, userId), isNull(record.deletedAt)));
      await tx
        .update(comment)
        .set({ deletedAt: now })
        .where(and(eq(comment.authorId, userId), isNull(comment.deletedAt)));
    }
    // Memberships cascade away with the user, so mark them left first and re-run open votes.
    await tx
      .update(membership)
      .set({ leftAt: now })
      .where(and(eq(membership.userId, userId), isNull(membership.leftAt)));
    for (const m of mine) await reevaluateOpen(tx, m.habitatId, now);
    await tx.delete(user).where(eq(user.id, userId));
  });
}

export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    image?: string | null;
    onboarded?: true;
    emailPrefs?: { digest: boolean; events: boolean; proposals: boolean };
  },
) {
  const set: Partial<typeof user.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.image !== undefined) set.image = patch.image;
  if (patch.emailPrefs) set.emailPrefs = patch.emailPrefs;
  if (patch.onboarded) set.onboardedAt = new Date();
  await getDb().update(user).set(set).where(eq(user.id, userId));
}
