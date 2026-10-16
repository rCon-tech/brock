import { ModuleCard } from '@/components/ModuleCard';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { listActive } from '@/lib/installed-modules';
import { openProposalsByModule } from '@/lib/proposals';
import { requireMemberBySlug } from '@/lib/session';
import { listLibrary } from '@/modules/registry';

export const metadata = { title: 'Library' };

const CATEGORY: Record<string, string> = { social: 'Social', plans: 'Plans', fun: 'Fun', practical: 'Practical' };

export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}/library` });
  const { ctx } = await requireMemberBySlug(getDb(), slug, user.id);
  const installed = new Set((await listActive(getDb(), ctx.habitatId)).map((a) => a.manifest.id));
  const open = await openProposalsByModule(ctx);
  const library = listLibrary();
  const categories = [...new Set(library.map((m) => m.category))];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Library</h1>
        <p className="text-sm text-ink-soft">The pieces your Habitat is built from. Anyone can suggest one, and the group votes.</p>
      </div>
      {categories.map((c) => (
        <section key={c}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{CATEGORY[c] ?? c}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {library
              .filter((m) => m.category === c)
              .map((m) => (
                <ModuleCard
                  key={m.id}
                  slug={slug}
                  m={{
                    id: m.id,
                    name: m.name,
                    tagline: m.tagline,
                    icon: m.icon,
                    installed: installed.has(m.id),
                    voteOpen: open.get(m.id) ? { yes: open.get(m.id)!.yes, memberCount: open.get(m.id)!.memberCount } : null,
                  }}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
