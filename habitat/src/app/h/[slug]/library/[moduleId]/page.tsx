import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { ModuleIcon } from '@/components/ModuleIcon';
import { ProposalCard } from '@/components/ProposalCard';
import { ProposeDialog } from '@/components/ProposeDialog';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { listActive } from '@/lib/installed-modules';
import { openProposalsByModule } from '@/lib/proposals';
import { requireMemberBySlug } from '@/lib/session';
import { getManifest } from '@/modules/registry';
import { fieldSummary } from '@/modules/sdk/describe';

export default async function ModuleDetail({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const manifest = getManifest(moduleId);
  if (!manifest) notFound();
  const user = await requireUser({ next: `/h/${slug}/library/${moduleId}` });
  const { ctx } = await requireMemberBySlug(getDb(), slug, user.id);
  const installed = (await listActive(getDb(), ctx.habitatId)).some(
    (a) => a.manifest.id === moduleId,
  );
  const open = (await openProposalsByModule(ctx)).get(moduleId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href={`/h/${slug}/library`}
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={14} /> Library
      </Link>
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <ModuleIcon name={manifest.icon} size={28} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{manifest.name}</h1>
          <p className="text-ink-soft">{manifest.tagline}</p>
        </div>
      </div>
      <p>{manifest.description}</p>

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Lock size={16} /> What it stores
        </h2>
        <p className="text-sm text-ink-soft">
          Everything stays inside this Habitat and is only visible to its members.
        </p>
        <ul className="space-y-1 text-sm">
          {Object.entries(manifest.collections).map(([name, c]) => (
            <li key={name}>
              <strong className="capitalize">{name}</strong>: {fieldSummary(c.fields)}
              {c.permissions?.hiddenFrom && (
                <Badge className="ml-2">hidden from the person it’s about</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {open ? (
        <ProposalCard p={open} />
      ) : installed ? (
        <div className="flex items-center gap-3">
          <Badge tone="ok">Installed</Badge>
          <ProposeDialog
            kind="uninstall"
            moduleId={manifest.id}
            moduleName={manifest.name}
            trigger={<Button variant="outline">Propose removing it</Button>}
          />
        </div>
      ) : (
        <ProposeDialog
          kind="install"
          moduleId={manifest.id}
          moduleName={manifest.name}
          trigger={<Button size="lg">Propose adding {manifest.name}</Button>}
        />
      )}
    </div>
  );
}
