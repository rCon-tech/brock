import { ProposalCard } from '@/components/ProposalCard';
import { EmptyState } from '@/components/EmptyState';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { listProposals } from '@/lib/proposals';
import { requireMemberBySlug } from '@/lib/session';
import Link from 'next/link';

export const metadata = { title: 'Votes' };

export default async function ProposalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}/proposals` });
  const { ctx } = await requireMemberBySlug(getDb(), slug, user.id);
  const all = await listProposals(ctx);
  const open = all.filter((p) => p.status === 'open');
  const past = all.filter((p) => p.status !== 'open');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Votes</h1>
        <p className="text-sm text-ink-soft">Changes to your Habitat are decided together.</p>
      </div>
      <section className="space-y-3">
        <h2 className="font-bold">Open</h2>
        {open.length === 0 ? (
          <EmptyState emoji="🗳️" title="Nothing to vote on">
            See something missing? Browse the <Link className="text-accent underline" href={`/h/${slug}/library`}>library</Link> and suggest it.
          </EmptyState>
        ) : (
          open.map((p) => <ProposalCard key={p.id} p={p} />)
        )}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Past</h2>
          {past.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </section>
      )}
    </div>
  );
}
