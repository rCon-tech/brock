import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { createHabitat } from '@/lib/habitats';
import { install } from '@/lib/installed-modules';
import type { MemberCtx } from '@/lib/session';

let counter = 0;

export async function makeUser(name = `User ${++counter}`) {
  const id = randomUUID();
  await getDb()
    .insert(s.user)
    .values({ id, name, email: `${id}@example.com`, emailVerified: true });
  return { id, name };
}

export interface TestHabitat {
  id: string;
  slug: string;
  /** members[0] is the owner. */
  members: MemberCtx[];
}

/** A Habitat with `members` people (the first is the owner) and the default modules plus `extraModules`. */
export async function makeHabitat(
  opts: { members?: number; extraModules?: string[]; name?: string; governance?: 'majority' | 'unanimous' | 'admins' } = {},
): Promise<TestHabitat> {
  const db = getDb();
  const owner = await makeUser(`Owner ${++counter}`);
  const h = await createHabitat(owner.id, { name: opts.name ?? `Habitat ${counter}`, emoji: '🌿', accent: '#e8590c' });
  if (opts.governance) await db.update(s.habitat).set({ governance: opts.governance }).where(eq(s.habitat.id, h.id));
  for (const m of opts.extraModules ?? []) await install(db, h.id, m);
  const members: MemberCtx[] = [{ userId: owner.id, habitatId: h.id, role: 'owner', nickname: null }];
  for (let i = 1; i < (opts.members ?? 1); i++) {
    const u = await makeUser(`Member ${++counter}`);
    await db.insert(s.membership).values({ habitatId: h.id, userId: u.id, role: 'member' });
    members.push({ userId: u.id, habitatId: h.id, role: 'member', nickname: null });
  }
  return { id: h.id, slug: h.slug, members };
}

export async function makeMedia(habitatId: string, uploaderId: string, status: 'ready' | 'pending' = 'ready') {
  const id = randomUUID();
  await getDb().insert(s.media).values({
    id,
    habitatId,
    uploaderId,
    keyFull: `${habitatId}/${id}/full.jpg`,
    keyThumb: `${habitatId}/${id}/thumb.jpg`,
    mime: 'image/jpeg',
    bytes: 1000,
    width: 100,
    height: 100,
    status,
  });
  return id;
}

export async function setRole(h: TestHabitat, index: number, role: 'admin' | 'member') {
  await getDb()
    .update(s.membership)
    .set({ role })
    .where(eq(s.membership.userId, h.members[index]!.userId));
  h.members[index] = { ...h.members[index]!, role };
}
