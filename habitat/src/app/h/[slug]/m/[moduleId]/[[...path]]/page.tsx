import { notFound } from 'next/navigation';
import { ModuleHost } from '@/components/ModuleHost';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { DomainError } from '@/lib/errors';
import { requireInstalled } from '@/lib/installed-modules';
import { requireMemberBySlug } from '@/lib/session';

export default async function ModulePage({ params }: { params: Promise<{ slug: string; moduleId: string; path?: string[] }> }) {
  const { slug, moduleId, path = [] } = await params;
  const user = await requireUser({ next: `/h/${slug}/m/${moduleId}` });
  const db = getDb();
  const { ctx } = await requireMemberBySlug(db, slug, user.id);
  // A module that isn't installed (or was removed within the last 30 days) is simply not found.
  await requireInstalled(db, ctx.habitatId, moduleId).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-3xl">
      <ModuleHost moduleId={moduleId} path={path} />
    </div>
  );
}
