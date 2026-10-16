import { and, eq, isNull } from 'drizzle-orm';
import { habitat, membership, user } from '@/db/schema';
import type { Executor } from '@/db';
import { notFound } from './errors';
import type { Role } from './permissions';

export interface MemberCtx {
  userId: string;
  habitatId: string;
  role: Role;
  nickname: string | null;
}

/**
 * The one gate every Habitat route goes through. Not a member, or no such Habitat, are the
 * same 404 so outsiders can't tell which Habitats exist.
 */
export async function requireMember(
  db: Executor,
  habitatId: string,
  userId: string,
): Promise<MemberCtx> {
  if (!/^[0-9a-f-]{36}$/i.test(habitatId)) throw notFound();
  const [row] = await db
    .select({ role: membership.role, nickname: membership.nickname })
    .from(membership)
    .innerJoin(habitat, eq(habitat.id, membership.habitatId))
    .where(
      and(
        eq(membership.habitatId, habitatId),
        eq(membership.userId, userId),
        isNull(membership.leftAt),
        isNull(habitat.deletedAt),
      ),
    );
  if (!row) throw notFound();
  return { userId, habitatId, role: row.role, nickname: row.nickname };
}

/** Same, addressed by slug (the pages use URLs like /h/the-lads). */
export async function requireMemberBySlug(db: Executor, slug: string, userId: string) {
  const [h] = await db
    .select()
    .from(habitat)
    .where(and(eq(habitat.slug, slug), isNull(habitat.deletedAt)));
  if (!h) throw notFound();
  const ctx = await requireMember(db, h.id, userId);
  return { ctx, habitat: h };
}

export async function getUser(db: Executor, userId: string) {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  return u ?? null;
}
