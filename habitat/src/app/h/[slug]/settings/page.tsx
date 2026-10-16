import { notFound } from 'next/navigation';
import { HabitatSettings } from '@/components/HabitatSettings';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { listActive } from '@/lib/installed-modules';
import { isAtLeast } from '@/lib/permissions';
import { requireMemberBySlug } from '@/lib/session';

export const metadata = { title: 'Habitat settings' };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}/settings` });
  const { ctx, habitat } = await requireMemberBySlug(getDb(), slug, user.id);
  if (!isAtLeast(ctx.role, 'admin')) notFound();
  const active = await listActive(getDb(), ctx.habitatId);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">Habitat settings</h1>
      <HabitatSettings
        isOwner={ctx.role === 'owner'}
        initial={{
          name: habitat.name,
          emoji: habitat.emoji,
          accent: habitat.accent,
          description: habitat.description ?? '',
          membersCanInvite: habitat.membersCanInvite,
          voteWindowHours: habitat.voteWindowHours,
          governance: habitat.governance,
          modules: active.map((a) => ({ id: a.manifest.id, name: a.manifest.name })),
        }}
      />
    </div>
  );
}
