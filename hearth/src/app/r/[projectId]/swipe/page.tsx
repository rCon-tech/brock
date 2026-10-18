import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { SwipeDeck } from '@/components/SwipeDeck';
import { loadItemCards } from '@/lib/catalogue/load';
import { requireMember } from '@/lib/permissions';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { getDeckState } from '@/lib/swipes';
import { isFinished } from '@/lib/synthesis';
import { project as projectTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { finishRoundAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Swipe' };

export default async function SwipePage({
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
  const [proj] = await db.select().from(projectTable).where(eq(projectTable.id, projectId));
  const state = await getDeckState(db, me.id);

  if (state.macroDone && state.microDone) redirect(`/r/${projectId}/me?as=${me.id}`);

  const round = state.macroDone ? 'micro' : 'macro';
  const remaining = round === 'macro' ? state.remainingMacro : state.remainingMicro;
  const reserveIds = round === 'macro' ? state.reserveMacro : state.reserveMicro;
  const cardMap = await loadItemCards(db, [...remaining, ...reserveIds]);
  const cards = remaining.flatMap((id) => cardMap.get(id) ?? []);
  const reserves = reserveIds.flatMap((id) => cardMap.get(id) ?? []);

  // On a shared phone, hand over to the next person who hasn't swiped yet (R17).
  const nextPerson = hosted.find((h) => h.id !== me.id && !isFinished(h));
  const afterMicro =
    proj.mode === 'together_one_device' && nextPerson
      ? `/r/${projectId}/handoff?from=${me.id}&to=${nextPerson.id}`
      : `/r/${projectId}/me?as=${me.id}`;

  return (
    <SwipeDeck
      key={`${me.id}-${round}`}
      participantId={me.id}
      round={round}
      cards={cards}
      reserves={reserves}
      total={round === 'macro' ? proj.macroDeck.length : proj.microDeck.length}
      vetoesLeft={state.vetoesLeft}
      heading={
        round === 'macro'
          ? `${hosted.length > 1 ? `${me.displayName}: ` : ''}The rooms`
          : `${hosted.length > 1 ? `${me.displayName}: ` : ''}The pieces`
      }
      finish={finishRoundAction.bind(null, projectId, me.id, round)}
      nextHref={round === 'macro' ? null : afterMicro}
      interlude={{
        title: 'Halfway there!',
        body: 'Now the pieces: sofas, rugs, lamps and more. Same idea, just closer up.',
        button: 'Show me the pieces',
      }}
    />
  );
}
