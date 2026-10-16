import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { installedModule } from '@/db/schema';
import { habitatRoute, parseBody } from '@/lib/api';
import { forbidden, invalid } from '@/lib/errors';
import { requireInstalled } from '@/lib/installed-modules';
import { can } from '@/lib/permissions';
import { compileFields } from '@/modules/sdk/fields';
import { z } from 'zod';

const Body = z.object({ settings: z.record(z.string(), z.unknown()) });

/** Admins change a module's own settings directly; members propose it (kind: 'settings'). */
export const PATCH = habitatRoute<{ habitatId: string; moduleId: string }>(
  async ({ req, member, params }) => {
    if (!can(member.role, 'module.settings')) throw forbidden();
    const db = getDb();
    const manifest = await requireInstalled(db, member.habitatId, params.moduleId);
    if (!manifest.settings) throw invalid('That module has no settings.');
    const parsed = compileFields(manifest.settings).safeParse(
      (await parseBody(req, Body)).settings,
    );
    if (!parsed.success) throw invalid('Those settings aren’t valid.');
    await db
      .update(installedModule)
      .set({ settings: parsed.data })
      .where(
        and(
          eq(installedModule.habitatId, member.habitatId),
          eq(installedModule.moduleId, params.moduleId),
          isNull(installedModule.removedAt),
        ),
      );
  },
);
