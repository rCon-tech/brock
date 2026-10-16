import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat } from '@/db/schema';
import { habitatRoute, parseBody } from '@/lib/api';
import { deleteHabitat, transferOwnership, updateHabitat } from '@/lib/habitats';
import { listActive } from '@/lib/installed-modules';
import { TransferBody, UpdateHabitatBody } from '@/lib/validation';

type P = { habitatId: string };

export const GET = habitatRoute<P>(async ({ member }) => {
  const db = getDb();
  const [h] = await db.select().from(habitat).where(eq(habitat.id, member.habitatId));
  const modules = await listActive(db, member.habitatId);
  return {
    habitat: {
      id: h!.id,
      slug: h!.slug,
      name: h!.name,
      emoji: h!.emoji,
      accent: h!.accent,
      description: h!.description,
      governance: h!.governance,
      voteWindowHours: h!.voteWindowHours,
      memberCap: h!.memberCap,
      membersCanInvite: h!.membersCanInvite,
    },
    me: { role: member.role, nickname: member.nickname },
    modules: modules.map((m) => ({
      id: m.manifest.id,
      name: m.manifest.name,
      icon: m.manifest.icon,
      nav: m.manifest.nav,
      settings: m.settings,
    })),
  };
});

export const PATCH = habitatRoute<P>(async ({ req, member }) => {
  const h = await updateHabitat(member, await parseBody(req, UpdateHabitatBody));
  return { habitat: { id: h.id, slug: h.slug } };
});

export const POST = habitatRoute<P>(async ({ req, member }) => {
  // POST /api/habitats/:id with { userId } hands the Habitat to someone else.
  await transferOwnership(member, (await parseBody(req, TransferBody)).userId);
});

export const DELETE = habitatRoute<P>(async ({ member }) => {
  await deleteHabitat(member);
});
