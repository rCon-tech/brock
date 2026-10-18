import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { RevealGate } from '@/components/RevealGate';
import { requireMember } from '@/lib/permissions';
import { getProjectState } from '@/lib/project-state';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { isFinished } from '@/lib/synthesis';
import { forceRevealAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'The reveal' };

export default async function RevealPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const [{ projectId }, { as }] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect('/');
  const db = await getDb();
  const hosted = await requireMember(db, projectId, user.id);
  const me = resolveParticipant(hosted, as);
  const state = await getProjectState(db, projectId);

  if (state.revealed) redirect(`/r/${projectId}/board?as=${me.id}`);
  if (!isFinished(me)) redirect(`/r/${projectId}/swipe?as=${me.id}`);
  if (!me.readyAt) redirect(`/r/${projectId}/me?as=${me.id}`);

  return (
    <RevealGate
      projectId={projectId}
      initial={state}
      boardHref={`/r/${projectId}/board?as=${me.id}`}
      forceReveal={forceRevealAction.bind(null, projectId)}
    />
  );
}
