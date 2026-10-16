import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { getDb, type Executor } from '@/db';
import { habitat, installedModule, record } from '@/db/schema';
import { getManifest } from '@/modules/registry';
import type { ModuleManifest } from '@/modules/sdk/types';
import { DomainError } from './errors';
import { logAudit } from './audit';
import type { MemberCtx } from './session';
import { can } from './permissions';
import { forbidden, invalid } from './errors';

export const PURGE_AFTER_DAYS = 30; // H9

export interface ActiveModule {
  manifest: ModuleManifest;
  position: number;
  settings: Record<string, unknown>;
}

/** Installed (not removed) modules, in the Habitat's chosen order. Unknown ids are skipped. */
export async function listActive(db: Executor, habitatId: string): Promise<ActiveModule[]> {
  const rows = await db
    .select()
    .from(installedModule)
    .where(and(eq(installedModule.habitatId, habitatId), isNull(installedModule.removedAt)));
  return rows
    .map((r) => ({ manifest: getManifest(r.moduleId), position: r.position, settings: r.settings }))
    .filter((r): r is ActiveModule => !!r.manifest)
    .sort((a, b) => a.position - b.position);
}

export async function requireInstalled(
  db: Executor,
  habitatId: string,
  moduleId: string,
): Promise<ModuleManifest> {
  const manifest = getManifest(moduleId);
  const [row] = manifest
    ? await db
        .select({ moduleId: installedModule.moduleId })
        .from(installedModule)
        .where(
          and(
            eq(installedModule.habitatId, habitatId),
            eq(installedModule.moduleId, moduleId),
            isNull(installedModule.removedAt),
          ),
        )
    : [];
  if (!manifest || !row)
    throw new DomainError('module_not_installed', 404, 'That module isn’t installed here.');
  return manifest;
}

/** Install, or restore a module removed within the last 30 days with all its data (H9). */
export async function install(
  db: Executor,
  habitatId: string,
  moduleId: string,
  opts: { proposalId?: string } = {},
): Promise<void> {
  const manifest = getManifest(moduleId);
  if (!manifest) throw new DomainError('unknown_module', 404, 'There’s no such module.');
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${installedModule.position}), -1) + 1` })
    .from(installedModule)
    .where(eq(installedModule.habitatId, habitatId));
  await db
    .insert(installedModule)
    .values({
      habitatId,
      moduleId,
      version: manifest.version,
      position: next,
      installedByProposalId: opts.proposalId ?? null,
    })
    .onConflictDoUpdate({
      target: [installedModule.habitatId, installedModule.moduleId],
      set: {
        removedAt: null,
        version: manifest.version,
        installedByProposalId: opts.proposalId ?? null,
      },
    });
}

/** Soft: data is hidden, not deleted, until the purge job runs 30 days later. */
export async function uninstall(
  db: Executor,
  habitatId: string,
  moduleId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(installedModule)
    .set({ removedAt: now })
    .where(and(eq(installedModule.habitatId, habitatId), eq(installedModule.moduleId, moduleId)));
}

export async function reorder(ctx: MemberCtx, order: string[]): Promise<void> {
  if (!can(ctx.role, 'module.settings')) throw forbidden();
  const db = getDb();
  await db.transaction(async (tx) => {
    const active = await listActive(tx, ctx.habitatId);
    const ids = new Set(active.map((a) => a.manifest.id));
    if (
      order.length !== ids.size ||
      !order.every((id) => ids.has(id)) ||
      new Set(order).size !== order.length
    ) {
      throw invalid('Send every installed module exactly once.');
    }
    for (const [i, id] of order.entries()) {
      await tx
        .update(installedModule)
        .set({ position: i })
        .where(and(eq(installedModule.habitatId, ctx.habitatId), eq(installedModule.moduleId, id)));
    }
    await logAudit(tx, ctx.habitatId, ctx.userId, 'modules.reordered', { order });
  });
}

/** Nightly: hard-delete data of modules removed more than 30 days ago, and Habitats deleted likewise. */
export async function purgeRemoved(
  now = new Date(),
): Promise<{ modules: number; habitats: number }> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 86400_000);
  let modules = 0;
  const stale = await db
    .select()
    .from(installedModule)
    .where(and(isNotNull(installedModule.removedAt), lt(installedModule.removedAt, cutoff)));
  for (const m of stale) {
    await db.transaction(async (tx) => {
      await tx
        .delete(record)
        .where(and(eq(record.habitatId, m.habitatId), eq(record.moduleId, m.moduleId)));
      await tx
        .delete(installedModule)
        .where(
          and(eq(installedModule.habitatId, m.habitatId), eq(installedModule.moduleId, m.moduleId)),
        );
    });
    modules++;
  }
  const doomed = await db
    .delete(habitat)
    .where(and(isNotNull(habitat.deletedAt), lt(habitat.deletedAt, cutoff)))
    .returning({ id: habitat.id });
  return { modules, habitats: doomed.length };
}
