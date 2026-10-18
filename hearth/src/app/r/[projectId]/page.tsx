import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getDb } from '@/db';
import { ActionButton } from '@/components/ActionButton';
import { InvitePanel } from '@/components/InvitePanel';
import { Poller } from '@/components/Poller';
import { ReminderButton } from '@/components/ReminderButton';
import { AddPersonForm } from '@/components/AddPersonForm';
import { env } from '@/lib/env';
import { currentInviteToken, MAX_PARTICIPANTS } from '@/lib/invites';
import { reminderText } from '@/lib/participants';
import { requireMember } from '@/lib/permissions';
import { getProjectState } from '@/lib/project-state';
import { projectParticipants } from '@/lib/projects';
import { soloBoardAllowed } from '@/lib/reveal';
import { getSessionUser } from '@/lib/session';
import { isFinished } from '@/lib/synthesis';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';
import { project as projectTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  deleteProjectAction,
  forceRevealAction,
  markReadyAction,
  regenerateInviteAction,
  removeParticipantAction,
  startOverAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your room' };

export default async function Hub({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/');
  const db = await getDb();
  const hosted = await requireMember(db, projectId, user.id);
  const [proj] = await db.select().from(projectTable).where(eq(projectTable.id, projectId));
  const people = await projectParticipants(db, projectId);
  const state = await getProjectState(db, projectId);
  const isCreator = proj.createdBy === user.id;
  const roomLabel = ROOM_LABELS[proj.roomType as RoomType];
  const title = proj.name || roomLabel;
  const onePhone = proj.mode === 'together_one_device';
  const creator = people.find((p) => p.role === 'creator');

  const needsInvite =
    isCreator && !onePhone && people.length < MAX_PARTICIPANTS && !proj.revealedAt;
  let invite: { url: string; qr: string } | null = null;
  if (needsInvite) {
    const token = await currentInviteToken(db, projectId);
    const url = `${env.NEXT_PUBLIC_SITE_URL}/j/${token}`;
    invite = { url, qr: await QRCode.toString(url, { type: 'svg', margin: 0, width: 160 }) };
  }

  const finishedCount = people.filter(isFinished).length;
  const waitingOn = people.filter((p) => !isFinished(p));
  const canForce = !proj.revealedAt && finishedCount >= 2 && people.length >= 2;
  const reminderTargets = waitingOn.filter((p) => !hosted.some((h) => h.id === p.id));

  return (
    <div className="flex flex-col gap-6">
      <Poller projectId={projectId} signature={state.signature} />
      <header className="flex flex-col gap-1">
        {proj.name ? <p className="eyebrow">{roomLabel}</p> : null}
        <h1 className="text-3xl font-bold">{title}</h1>
      </header>

      {proj.revealedAt ? (
        <div className="card flex flex-col gap-3 bg-sage-soft p-4">
          <p className="font-semibold">Your board is ready.</p>
          <div className="flex flex-wrap gap-2">
            {hosted.map((h) => (
              <Link
                key={h.id}
                href={`/r/${projectId}/board?as=${h.id}`}
                className="btn btn-primary"
              >
                {hosted.length > 1 ? `Open the board as ${h.displayName}` : 'Open the board'}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <section aria-labelledby="people" className="flex flex-col gap-3">
        <h2 id="people" className="text-xl font-bold">
          Who’s in
        </h2>
        <ul className="flex flex-col gap-2">
          {people.map((p) => {
            const mine = hosted.some((h) => h.id === p.id);
            const finished = isFinished(p);
            const started = !!p.macroDoneAt;
            const status = finished
              ? p.readyAt
                ? 'Ready'
                : 'Finished swiping'
              : started
                ? 'Halfway there'
                : 'Not started';
            return (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-blush font-display font-bold text-clay-dark"
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    <span className="block font-semibold">
                      {p.displayName}
                      {mine && !onePhone ? ' (you)' : ''}
                    </span>
                    <span className={`chip ${finished ? 'chip-sage' : ''}`}>{status}</span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {mine && !finished ? (
                    <Link
                      href={`/r/${projectId}/swipe?as=${p.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      {started
                        ? 'Continue'
                        : onePhone
                          ? `Swipe as ${p.displayName}`
                          : 'Start swiping'}
                    </Link>
                  ) : null}
                  {mine && finished && !proj.revealedAt ? (
                    <Link
                      href={`/r/${projectId}/me?as=${p.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      {p.readyAt ? 'Your style' : 'See your style'}
                    </Link>
                  ) : null}
                  {isCreator && p.role !== 'creator' ? (
                    <ActionButton
                      className="btn btn-ghost btn-sm"
                      confirm={`Remove ${p.displayName} from this room? Their swipes will be deleted.`}
                      action={removeParticipantAction.bind(null, projectId, p.id)}
                    >
                      Remove
                    </ActionButton>
                  ) : null}
                  {!isCreator && mine && p.role !== 'creator' ? (
                    <ActionButton
                      className="btn btn-ghost btn-sm"
                      confirm="Leave this room? Your swipes will be deleted."
                      redirectTo="/projects"
                      action={removeParticipantAction.bind(null, projectId, p.id)}
                    >
                      Leave
                    </ActionButton>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        {onePhone && people.length < MAX_PARTICIPANTS && !proj.revealedAt ? (
          <AddPersonForm projectId={projectId} />
        ) : null}
      </section>

      {!proj.revealedAt && finishedCount > 0 ? (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-lg font-bold">
            {waitingOn.length === 0
              ? 'Everyone’s finished'
              : `Waiting for ${waitingOn.map((p) => p.displayName).join(' and ')}`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {hosted
              .filter((h) => isFinished(h) && !h.readyAt)
              .map((h) => (
                <ActionButton
                  key={h.id}
                  className="btn btn-primary"
                  action={markReadyAction.bind(null, projectId, h.id)}
                >
                  {hosted.length > 1 ? `${h.displayName} is ready` : 'I’m ready to see it'}
                </ActionButton>
              ))}
            {reminderTargets.length > 0 && !onePhone ? (
              <ReminderButton
                label={`Remind ${reminderTargets[0].displayName}`}
                message={reminderText({ fromName: creator?.displayName ?? 'Someone', roomLabel })}
                url={invite?.url ?? `${env.NEXT_PUBLIC_SITE_URL}/r/${projectId}`}
              />
            ) : null}
            {canForce ? (
              <ActionButton
                className="btn btn-ghost"
                confirm="Show the board now, without the people who haven’t finished?"
                action={forceRevealAction.bind(null, projectId)}
              >
                Show results now
              </ActionButton>
            ) : null}
            {hosted.map((h) =>
              soloBoardAllowed(proj, h, people) ? (
                <Link
                  key={h.id}
                  href={`/r/${projectId}/board?as=${h.id}`}
                  className="btn btn-ghost"
                >
                  See my board for now
                </Link>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {invite ? (
        <InvitePanel
          url={invite.url}
          qrSvg={invite.qr}
          fromName={creator?.displayName ?? 'Someone'}
          roomLabel={roomLabel}
        />
      ) : null}

      <section className="flex flex-wrap gap-2 border-t border-sand pt-4">
        {isCreator && needsInvite ? (
          <ActionButton
            className="btn btn-ghost btn-sm"
            confirm="This replaces the current link. Anyone with the old link won’t be able to join."
            action={regenerateInviteAction.bind(null, projectId)}
          >
            Make a new invite link
          </ActionButton>
        ) : null}
        {!proj.revealedAt
          ? hosted
              .filter((h) => h.macroDoneAt || h.microDoneAt)
              .map((h) => (
                <ActionButton
                  key={h.id}
                  className="btn btn-ghost btn-sm"
                  confirm="Clear your swipes and start the cards again?"
                  action={startOverAction.bind(null, h.id)}
                >
                  {hosted.length > 1 ? `Start over as ${h.displayName}` : 'Start over'}
                </ActionButton>
              ))
          : null}
        {isCreator ? (
          <ActionButton
            className="btn btn-danger btn-sm"
            confirm="Delete this room for everyone? This can’t be undone."
            action={deleteProjectAction.bind(null, projectId)}
          >
            Delete room
          </ActionButton>
        ) : null}
      </section>
    </div>
  );
}
