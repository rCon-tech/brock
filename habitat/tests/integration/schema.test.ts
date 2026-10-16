import { describe, expect, it } from 'vitest';
import { getDb } from '@/db';
import * as s from '@/db/schema';

async function seed() {
  const db = getDb();
  await db.insert(s.user).values([
    { id: 'u1', name: 'One', email: 'one@example.com' },
    { id: 'u2', name: 'Two', email: 'two@example.com' },
  ]);
  const [h] = await db
    .insert(s.habitat)
    .values({ slug: 'the-lads', name: 'The Lads', createdBy: 'u1' })
    .returning();
  return h!;
}

describe('schema constraints', () => {
  it('rejects a second open proposal for the same module', async () => {
    const h = await seed();
    const row = {
      habitatId: h.id,
      kind: 'install' as const,
      moduleId: 'polls',
      closesAt: new Date(),
    };
    await getDb().insert(s.proposal).values(row);
    await expect(getDb().insert(s.proposal).values(row)).rejects.toThrow();
  });

  it('allows a new proposal once the old one is decided', async () => {
    const h = await seed();
    const row = {
      habitatId: h.id,
      kind: 'install' as const,
      moduleId: 'polls',
      closesAt: new Date(),
    };
    await getDb()
      .insert(s.proposal)
      .values({ ...row, status: 'rejected' });
    await getDb().insert(s.proposal).values(row);
  });

  it('rejects a second owner', async () => {
    const h = await seed();
    await getDb().insert(s.membership).values({ habitatId: h.id, userId: 'u1', role: 'owner' });
    await expect(
      getDb().insert(s.membership).values({ habitatId: h.id, userId: 'u2', role: 'owner' }),
    ).rejects.toThrow();
  });

  it('allows a new owner after the old one has left', async () => {
    const h = await seed();
    await getDb()
      .insert(s.membership)
      .values({ habitatId: h.id, userId: 'u1', role: 'owner', leftAt: new Date() });
    await getDb().insert(s.membership).values({ habitatId: h.id, userId: 'u2', role: 'owner' });
  });

  it('rejects a duplicate unique_key but allows it after soft delete', async () => {
    const h = await seed();
    const row = {
      habitatId: h.id,
      moduleId: 'events',
      collection: 'rsvp',
      authorId: 'u1',
      data: {},
      uniqueKey: 'p:u1',
    };
    const [first] = await getDb().insert(s.record).values(row).returning();
    await expect(getDb().insert(s.record).values(row)).rejects.toThrow();
    await getDb()
      .update(s.record)
      .set({ deletedAt: new Date() })
      .where((await import('drizzle-orm')).eq(s.record.id, first!.id));
    await getDb().insert(s.record).values(row);
  });

  it('rejects a duplicate slug', async () => {
    await seed();
    await expect(
      getDb().insert(s.habitat).values({ slug: 'the-lads', name: 'Other', createdBy: 'u1' }),
    ).rejects.toThrow();
  });
});
