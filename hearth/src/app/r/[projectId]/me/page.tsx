import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getDb } from '@/db';
import { ActionButton } from '@/components/ActionButton';
import { InvitePanel } from '@/components/InvitePanel';
import { MyStyleCard } from '@/components/MyStyleCard';
import { Poller } from '@/components/Poller';
import { env } from '@/lib/env';
import { currentInviteToken, MAX_PARTICIPANTS } from '@/lib/invites';
import { personalResult } from '@/lib/personal-result';
import { requireMember } from '@/lib/permissions';
import { getProjectState } from '@/lib/project-state';
import { projectParticipants } from '@/lib/projects';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { isFinished } from '@/lib/synthesis';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';
import { project as projectTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { markReadyAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your style' };

export default async function MePage({
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
  if (!isFinished(me)) redirect(`/r/${projectId}/swipe?as=${me.id}`);

  const [proj] = await db.select().from(projectTable).where(eq(projectTable.id, projectId));
  if (proj.revealedAt) redirect(`/r/${projectId}/board?as=${me.id}`);

  const people = await projectParticipants(db, projectId);
  const state = await getProjectState(db, projectId);
  const result = await personalResult(db, me.id);
  const others = people.filter((p) => !hosted.some((h) => h.id === p.id));
  const waitingOn = others.filter((p) => !isFinished(p));
  const roomLabel = ROOM_LABELS[proj.roomType as RoomType];
  const onlyYou = people.length === 1;

  // A quiz-taker with nobody else yet gets the invite right here: the next step is a partner.
  let invite: { url: string; qr: string } | null = null;
  if (
    onlyYou &&
    proj.createdBy === user.id &&
    people.length < MAX_PARTICIPANTS &&
    proj.mode !== 'together_one_device'
  ) {
    const token = await currentInviteToken(db, projectId);
    const url = `${env.NEXT_PUBLIC_SITE_URL}/j/${token}`;
    invite = { url, qr: await QRCode.toString(url, { type: 'svg', margin: 0, width: 160 }) };
  }

  return (
    <div className="flex flex-col gap-5">
      <Poller projectId={projectId} signature={state.signature} />
      <MyStyleCard result={result} name={hosted.length > 1 ? me.displayName : 'Your'} />

      {onlyYou ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Now find out how it fits with someone else’s</h2>
          <p className="text-sm text-muted">
            Send the link below. They swipe the same cards, and Hearth finds the style you both can
            live with.
          </p>
          {invite ? (
            <InvitePanel
              url={invite.url}
              qrSvg={invite.qr}
              fromName={me.displayName}
              roomLabel={roomLabel}
            />
          ) : null}
          <Link href={`/r/${projectId}/board?as=${me.id}`} className="btn btn-secondary self-start">
            See a board built from just my swipes
          </Link>
        </div>
      ) : (
        <div className="card flex flex-col gap-3 p-4">
          <h2 className="text-lg font-bold">
            {waitingOn.length === 0
              ? 'Everyone’s finished'
              : `Waiting for ${waitingOn.map((p) => p.displayName).join(' and ')}`}
          </h2>
          <p className="text-sm text-muted">
            You can’t see anyone else’s swipes until the board is ready. That keeps everyone honest.
          </p>
          {me.readyAt ? (
            <Link
              href={`/r/${projectId}/reveal?as=${me.id}`}
              className="btn btn-primary self-start"
            >
              Go to the reveal
            </Link>
          ) : (
            <ActionButton
              className="btn btn-primary self-start"
              redirectTo={`/r/${projectId}/reveal?as=${me.id}`}
              action={markReadyAction.bind(null, projectId, me.id)}
            >
              I’m ready to see the board
            </ActionButton>
          )}
          <Link href={`/r/${projectId}`} className="text-sm text-muted underline">
            Back to the room
          </Link>
        </div>
      )}
    </div>
  );
}
