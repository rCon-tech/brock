import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, type Executor } from '@/db';
import { habitat, installedModule, membership } from '@/db/schema';
import { defaultModuleIds } from '@/modules/registry';
import { conflict, forbidden, invalid, isUniqueViolation, notFound } from './errors';
import { logAudit } from './audit';
import { install } from './installed-modules';
import { can } from './permissions';
import type { MemberCtx } from './session';
import { isReserved, slugify, withSuffix } from './slug';

export interface CreateHabitatInput {
  name: string;
  emoji: string;
  accent: string;
  modules?: string[];
}

export async function createHabitat(userId: string, input: CreateHabitatInput) {
  const wanted = input.modules ?? defaultModuleIds();
  const defaults = new Set(defaultModuleIds());
  const bad = wanted.filter((m) => !defaults.has(m));
  if (bad.length) throw invalid(`Only the starting modules can be chosen here: ${bad.join(', ')}.`);

  const base = slugify(input.name);
  for (let attempt = 1; attempt <= 8; attempt++) {
    const slug = await freeSlug(getDb(), base, attempt);
    try {
      return await getDb().transaction(async (tx) => {
        const [h] = await tx
          .insert(habitat)
          .values({
            slug,
            name: input.name,
            emoji: input.emoji,
            accent: input.accent,
            createdBy: userId,
          })
          .returning();
        await tx.insert(membership).values({ habitatId: h!.id, userId, role: 'owner' });
        for (const id of wanted) await install(tx, h!.id, id);
        await logAudit(tx, h!.id, userId, 'habitat.created', { modules: wanted });
        return h!;
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // lost a race for the slug: try the next suffix
    }
  }
  throw conflict('slug_taken', 'Couldn’t find a free address for that name. Try another.');
}

async function freeSlug(db: Executor, base: string, startAt: number): Promise<string> {
  for (let n = startAt; n < startAt + 50; n++) {
    const candidate = withSuffix(base, n);
    if (isReserved(candidate)) continue;
    const [row] = await db.select({ id: habitat.id }).from(habitat).where(eq(habitat.slug, candidate));
    if (!row) return candidate;
  }
  throw conflict('slug_taken', 'Couldn’t find a free address for that name. Try another.');
}

export async function listMyHabitats(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: habitat.id,
      slug: habitat.slug,
      name: habitat.name,
      emoji: habitat.emoji,
      accent: habitat.accent,
      role: membership.role,
      memberCount: sql<number>`(select count(*)::int from membership m where m.habitat_id = ${habitat.id} and m.left_at is null)`,
    })
    .from(membership)
    .innerJoin(habitat, eq(habitat.id, membership.habitatId))
    .where(and(eq(membership.userId, userId), isNull(membership.leftAt), isNull(habitat.deletedAt)))
    .orderBy(habitat.name);
  return rows;
}

export interface HabitatPatch {
  name?: string;
  emoji?: string;
  accent?: string;
  description?: string | null;
  membersCanInvite?: boolean;
  memberCap?: number;
  voteWindowHours?: number;
}

export async function updateHabitat(ctx: MemberCtx, patch: HabitatPatch) {
  if (!can(ctx.role, 'habitat.update')) throw forbidden();
  const db = getDb();
  return db.transaction(async (tx) => {
    if (patch.memberCap !== undefined) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(membership)
        .where(and(eq(membership.habitatId, ctx.habitatId), isNull(membership.leftAt)));
      if (patch.memberCap < n) throw invalid(`There are already ${n} members, so the cap can’t go lower.`);
    }
    const [h] = await tx.update(habitat).set(patch).where(eq(habitat.id, ctx.habitatId)).returning();
    await logAudit(tx, ctx.habitatId, ctx.userId, 'habitat.updated', { fields: Object.keys(patch) });
    return h!;
  });
}

export async function deleteHabitat(ctx: MemberCtx, now = new Date()) {
  if (!can(ctx.role, 'habitat.delete')) throw forbidden('Only the owner can delete a Habitat.');
  await getDb().update(habitat).set({ deletedAt: now }).where(eq(habitat.id, ctx.habitatId));
}

export async function transferOwnership(ctx: MemberCtx, newOwnerId: string) {
  if (!can(ctx.role, 'habitat.transfer')) throw forbidden('Only the owner can hand over a Habitat.');
  if (newOwnerId === ctx.userId) throw invalid('You already own this Habitat.');
  await getDb().transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(membership)
      .where(
        and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, newOwnerId), isNull(membership.leftAt)),
      );
    if (!target) throw notFound('They aren’t a member.');
    // Demote first: the database allows only one active owner at a time.
    await tx
      .update(membership)
      .set({ role: 'admin' })
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, ctx.userId)));
    await tx
      .update(membership)
      .set({ role: 'owner' })
      .where(and(eq(membership.habitatId, ctx.habitatId), eq(membership.userId, newOwnerId)));
    await logAudit(tx, ctx.habitatId, ctx.userId, 'habitat.transferred', { to: newOwnerId });
  });
}

export async function getHabitatById(db: Executor, id: string) {
  const [h] = await db
    .select()
    .from(habitat)
    .where(and(eq(habitat.id, id), isNull(habitat.deletedAt)));
  return h ?? null;
}

export async function activeModuleIds(db: Executor, habitatId: string) {
  const rows = await db
    .select({ id: installedModule.moduleId })
    .from(installedModule)
    .where(and(eq(installedModule.habitatId, habitatId), isNull(installedModule.removedAt)));
  return rows.map((r) => r.id);
}
