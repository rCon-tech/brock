import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { requireMember } from '@/lib/permissions';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pass the phone' };

/** Between people on a shared phone: nothing about the last person's choices is shown (R17). */
export default async function Handoff({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [{ projectId }, { from, to }] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect('/');
  const hosted = await requireMember(await getDb(), projectId, user.id);
  const next = hosted.find((h) => h.id === to);
  const prev = hosted.find((h) => h.id === from);
  if (!next) redirect(`/r/${projectId}`);

  return (
    <div className="mt-10 flex flex-col items-center gap-6 rounded-3xl bg-ink px-6 py-16 text-center text-paper">
      <p className="eyebrow text-paper/70">{prev ? `Thanks, ${prev.displayName}` : 'All done'}</p>
      <h1 className="text-4xl font-bold">Pass the phone to {next.displayName}</h1>
      <p className="text-paper/80">
        No peeking. Your turn comes with the same cards, in a different order.
      </p>
      <Link href={`/r/${projectId}/swipe?as=${next.id}`} className="btn btn-primary">
        I’m {next.displayName}
      </Link>
    </div>
  );
}
