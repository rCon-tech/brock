import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { BoardFeedback, NextRoomCta, TiebreakCta } from '@/components/board/BoardActions';
import { BridgeStyleHero } from '@/components/board/BridgeStyleHero';
import { Differences } from '@/components/board/Differences';
import { EvidenceStrip } from '@/components/board/EvidenceStrip';
import { ProductGrid } from '@/components/board/ProductGrid';
import { ShoppingList } from '@/components/board/ShoppingList';
import { WhatYouEachBring } from '@/components/board/WhatYouEachBring';
import { CardImage } from '@/components/CardImage';
import { FakeDoor } from '@/components/FakeDoor';
import { Poller } from '@/components/Poller';
import { getBoard } from '@/lib/board';
import { availableRoomTypes } from '@/lib/catalogue/load';
import { requireMember } from '@/lib/permissions';
import { getProjectState } from '@/lib/project-state';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { ROOM_TYPES } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your board' };

export default async function BoardPage({
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
  const board = await getBoard(db, projectId, me.id);
  if (!board) redirect(`/r/${projectId}`);

  const state = await getProjectState(db, projectId);
  const { result } = board;
  const agreedLead = result.lead === 'agreed';
  const pickIds = result.picks.map((p) => p.itemId);
  const rooms =
    board.viewer.isCreator && board.kind === 'shared'
      ? await availableRoomTypes(db, ROOM_TYPES)
      : [];

  const agreed = (
    <section className="flex flex-col gap-3" aria-labelledby="agreed">
      <h2 id="agreed" className="text-2xl font-bold">
        You both said yes
      </h2>
      <ProductGrid board={board} participantId={me.id} itemIds={result.exactMicro} />
      {result.exactMacro.length > 0 ? (
        <>
          <h3 className="text-lg font-bold">Rooms you both loved</h3>
          <ul className="grid grid-cols-3 gap-2">
            {result.exactMacro.map((id) =>
              board.items[id] ? (
                <li key={id} className="overflow-hidden rounded-xl bg-sand">
                  <CardImage
                    src={board.items[id].imageUrl}
                    alt={board.items[id].title}
                    className="aspect-[4/5] w-full object-cover"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </>
      ) : null}
    </section>
  );

  const picks = (
    <section className="flex flex-col gap-3" aria-labelledby="picks">
      <div>
        <h2 id="picks" className="text-2xl font-bold">
          {result.solo ? 'Pieces we’d suggest' : 'Works for both of you'}
        </h2>
        <p className="text-sm text-muted">
          {result.solo
            ? 'Chosen from your swipes.'
            : 'Pieces neither of you swiped left on, chosen so everyone gets something they like.'}
        </p>
      </div>
      <ProductGrid
        board={board}
        participantId={me.id}
        itemIds={pickIds}
        swappable
        riskFilter
        empty="Nothing left to suggest at this budget."
      />
    </section>
  );

  return (
    <div className="flex flex-col gap-8">
      <Poller projectId={projectId} signature={state.signature} />

      {hosted.length > 1 ? (
        <nav aria-label="Viewing as" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Viewing as</span>
          {hosted.map((h) => (
            <Link
              key={h.id}
              href={`/r/${projectId}/board?as=${h.id}`}
              aria-current={h.id === me.id ? 'page' : undefined}
              className={`chip ${h.id === me.id ? 'bg-clay text-paper' : ''}`}
            >
              {h.displayName}
            </Link>
          ))}
        </nav>
      ) : null}

      {board.kind === 'solo' ? (
        <div role="status" className="card bg-sage-soft p-4 text-sm">
          <p className="font-semibold">This is your board for now.</p>
          <p className="text-muted">
            It’s built from your swipes alone. It becomes the shared board when everyone has
            finished.
          </p>
          <Link href={`/r/${projectId}`} className="mt-2 inline-block underline">
            Back to the room
          </Link>
        </div>
      ) : null}
      {board.joinedLate.length > 0 ? (
        <p role="status" className="card bg-sage-soft p-3 text-sm">
          Board updated: {board.joinedLate.join(' and ')} joined.
        </p>
      ) : null}

      <BridgeStyleHero board={board} />

      {agreedLead ? (
        <>
          {agreed}
          <EvidenceStrip board={board} />
          <WhatYouEachBring board={board} />
          {picks}
        </>
      ) : (
        <>
          <EvidenceStrip board={board} />
          <WhatYouEachBring board={board} />
          {picks}
          {result.exactMicro.length > 0 || result.exactMacro.length > 0 ? agreed : null}
        </>
      )}

      <Differences board={board} />
      <ShoppingList board={board} participantId={me.id} />

      {board.notForUs.length > 0 ? (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">
            Not for us ({board.notForUs.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {board.notForUs.map((id) =>
              board.items[id] ? <li key={id}>{board.items[id].title}</li> : null,
            )}
          </ul>
        </details>
      ) : null}

      <TiebreakCta board={board} participantId={me.id} />
      <NextRoomCta projectId={projectId} rooms={rooms} current={board.project.roomType} />

      <section className="flex flex-wrap gap-2">
        <Link href={`/r/${projectId}/brief?as=${me.id}`} className="btn btn-secondary">
          Open the style brief
        </Link>
      </section>

      <BoardFeedback participantId={me.id} initial={board.feedback} />
      <FakeDoor projectId={projectId} />
      <p className="text-xs text-muted">
        Some links are affiliate links. If you buy, Hearth may earn a commission at no extra cost to
        you. It never changes what we suggest.
      </p>
    </div>
  );
}
