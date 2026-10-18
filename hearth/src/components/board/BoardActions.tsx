'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  feedbackAction,
  nextRoomAction,
  startTiebreakAction,
} from '@/app/r/[projectId]/board/actions';
import { ActionButton } from '@/components/ActionButton';
import type { BoardView } from '@/lib/board';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';

/** The optional tie-breaker round that turns suggestions into agreements (R11). */
export function TiebreakCta({ board, participantId }: { board: BoardView; participantId: string }) {
  const { tiebreak, project } = board;
  if (board.kind === 'solo') return null;
  if (tiebreak.current) {
    return tiebreak.remaining.length > 0 ? (
      <section className="card flex flex-col gap-2 p-4">
        <h2 className="text-lg font-bold">Tie-breaker in progress</h2>
        <Link
          href={`/r/${project.id}/tiebreak?as=${participantId}`}
          className="btn btn-primary self-start"
        >
          Continue ({tiebreak.remaining.length} left)
        </Link>
      </section>
    ) : (
      <section className="card p-4">
        <h2 className="text-lg font-bold">Tie-breaker: waiting for the others</h2>
        <p className="text-sm text-muted">
          Your answers are in. The board updates when everyone has finished.
        </p>
      </section>
    );
  }
  if (!tiebreak.canStart) return null;
  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-lg font-bold">Want to firm things up?</h2>
      <p className="text-sm text-muted">
        Eight quick swipes on the suggestions neither of you has seen. Anything you both like moves
        into your shopping list.
        {tiebreak.roundsUsed > 0 ? ' You can do one more round.' : ''}
      </p>
      <ActionButton
        className="btn btn-primary self-start"
        action={startTiebreakAction.bind(null, project.id, participantId)}
      >
        Start the tie-breaker
      </ActionButton>
    </section>
  );
}

/** "Do the bedroom next": same people, fresh deck, household details carried over (R24). */
export function NextRoomCta({
  projectId,
  rooms,
  current,
}: {
  projectId: string;
  rooms: string[];
  current: string;
}) {
  const options = rooms.filter((r) => r !== current);
  if (options.length === 0) return null;
  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-lg font-bold">Do another room</h2>
      <p className="text-sm text-muted">
        Same people, and the next deck starts from the style you just found.
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((r) => (
          <ActionButton
            key={r}
            className="btn btn-secondary"
            action={nextRoomAction.bind(null, projectId, r)}
          >
            {ROOM_LABELS[r as RoomType]} next
          </ActionButton>
        ))}
      </div>
    </section>
  );
}

/** The success metric: did this help you agree? */
export function BoardFeedback({
  participantId,
  initial,
}: {
  participantId: string;
  initial: boolean | null;
}) {
  const [answer, setAnswer] = useState<boolean | null>(initial);
  return (
    <section className="card flex flex-col gap-2 p-4" aria-labelledby="helped">
      <h2 id="helped" className="text-lg font-bold">
        Did this help you agree?
      </h2>
      <div className="flex gap-2">
        {(
          [
            [true, '👍 Yes'],
            [false, '👎 Not really'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={answer === value}
            className={`btn btn-sm ${answer === value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={async () => {
              setAnswer(value);
              await feedbackAction(participantId, value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {answer !== null ? (
        <p role="status" className="text-xs text-muted">
          Thanks, that really helps.
        </p>
      ) : null}
    </section>
  );
}
