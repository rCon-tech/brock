import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { SwipeDeck } from '@/components/SwipeDeck';
import { loadItemCards } from '@/lib/catalogue/load';
import { requireMember } from '@/lib/permissions';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { tiebreakState } from '@/lib/tiebreak';
import { finishTiebreakAction } from '../swipe/actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tie-breaker' };

export default async function TiebreakPage({
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
  const state = await tiebreakState(db, projectId, me.id);
  const board = `/r/${projectId}/board?as=${me.id}`;
  if (!state.current) redirect(board);

  const cards = await loadItemCards(db, state.remaining);
  return (
    <SwipeDeck
      key={`${me.id}-${state.current.id}`}
      participantId={me.id}
      round="bridge"
      cards={state.remaining.flatMap((id) => cards.get(id) ?? [])}
      reserves={[]}
      total={state.current.itemIds.length}
      vetoesLeft={0}
      heading="Tie-breaker"
      finish={finishTiebreakAction.bind(null, projectId, me.id)}
      nextHref={board}
    />
  );
}
