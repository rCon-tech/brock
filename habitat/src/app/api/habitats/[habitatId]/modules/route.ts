import { habitatRoute, parseBody } from '@/lib/api';
import { getDb } from '@/db';
import { listActive, reorder } from '@/lib/installed-modules';
import { listLibrary } from '@/modules/registry';
import { openProposalsByModule } from '@/lib/proposals';
import { ModuleOrderBody } from '@/lib/validation';

type P = { habitatId: string };

/** Installed modules plus the whole library with each module's state (installed / vote open). */
export const GET = habitatRoute<P>(async ({ member }) => {
  const active = await listActive(getDb(), member.habitatId);
  const open = await openProposalsByModule(member);
  const installed = new Set(active.map((a) => a.manifest.id));
  return {
    installed: active.map((a) => ({
      id: a.manifest.id,
      position: a.position,
      settings: a.settings,
    })),
    library: listLibrary().map((m) => ({
      id: m.id,
      name: m.name,
      tagline: m.tagline,
      description: m.description,
      icon: m.icon,
      category: m.category,
      isDefault: !!m.isDefault,
      installed: installed.has(m.id),
      openProposal: open.get(m.id) ?? null,
      collections: Object.keys(m.collections),
    })),
  };
});

export const PATCH = habitatRoute<P>(async ({ req, member }) => {
  await reorder(member, (await parseBody(req, ModuleOrderBody)).order);
});
