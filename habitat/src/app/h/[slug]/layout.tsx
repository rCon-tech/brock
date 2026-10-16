import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { HabitatShell } from '@/components/HabitatShell';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { DomainError } from '@/lib/errors';
import { listActive } from '@/lib/installed-modules';
import { listMembers } from '@/lib/members';
import { requireMemberBySlug } from '@/lib/session';
import { inkFor } from '@/lib/utils';
import { HabitatProvider } from '@/modules/sdk/context';
import { photosEnabled } from '@/env';

export default async function HabitatLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}` });
  const db = getDb();
  const found = await requireMemberBySlug(db, slug, user.id).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  const { ctx, habitat } = found;
  const [members, active] = await Promise.all([
    listMembers(habitat.id),
    listActive(db, habitat.id),
  ]);

  const me = members.find((m) => m.userId === user.id)!;
  const nav = active
    .filter((a) => a.manifest.nav !== false && a.manifest.nav)
    .map((a) => ({
      id: a.manifest.id,
      label: a.manifest.nav ? a.manifest.nav.label : a.manifest.name,
      icon: a.manifest.icon,
    }));

  return (
    <div
      className="min-h-dvh bg-background"
      style={{
        ['--accent' as string]: habitat.accent,
        ['--accent-ink' as string]: inkFor(habitat.accent),
      }}
    >
      <HabitatProvider
        value={{
          habitatId: habitat.id,
          slug: habitat.slug,
          name: habitat.name,
          accent: habitat.accent,
          me: {
            id: user.id,
            name: user.name,
            image: user.image,
            nickname: me.nickname,
            role: ctx.role,
          },
          members: members.map((m) => ({
            id: m.userId,
            name: m.name,
            image: m.image,
            nickname: m.nickname,
            role: m.role,
          })),
          settings: Object.fromEntries(active.map((a) => [a.manifest.id, a.settings])),
          photosEnabled: photosEnabled(),
        }}
      >
        <RealtimeProvider>
          <HabitatShell
            habitat={{
              slug: habitat.slug,
              name: habitat.name,
              emoji: habitat.emoji,
              accent: habitat.accent,
            }}
            user={{ name: user.name, email: user.email, image: user.image }}
            role={ctx.role}
            nav={nav}
          >
            {children}
          </HabitatShell>
        </RealtimeProvider>
      </HabitatProvider>
    </div>
  );
}
