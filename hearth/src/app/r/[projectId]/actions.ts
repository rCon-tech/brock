'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { run } from '@/lib/action';
import { nameBridgeFor } from '@/lib/ai/namer';
import { addDeviceParticipant, removeParticipant } from '@/lib/participants';
import { requireCreator, requireHost, requireMember } from '@/lib/permissions';
import { deleteProject } from '@/lib/projects';
import { regenerateInvite } from '@/lib/invites';
import { markReady, maybeReveal } from '@/lib/reveal';
import { startOver } from '@/lib/swipes';
import { nameSynthesis } from '@/lib/synthesis';
import type { Db } from '@/db';

/** Names a freshly built board after the response has gone out; the page polls until it appears. */
export async function scheduleNaming(db: Db, projectId: string, version: number | undefined) {
  if (!version) return;
  after(async () => {
    await nameSynthesis(db, projectId, version, nameBridgeFor);
  });
}

export async function markReadyAction(projectId: string, participantId: string) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await markReady(db, participantId);
    const out = await maybeReveal(db, projectId);
    if (out.revealed) await scheduleNaming(db, projectId, out.version);
    return { revealed: out.revealed };
  });
}

/** "Reveal now": show the board even though someone hasn't tapped Ready (R18, R10). */
export async function forceRevealAction(projectId: string) {
  return run(async ({ db, userId }) => {
    await requireMember(db, projectId, userId);
    const out = await maybeReveal(db, projectId, { force: true });
    if (out.revealed) await scheduleNaming(db, projectId, out.version);
    return { revealed: out.revealed };
  });
}

export async function regenerateInviteAction(projectId: string) {
  return run(async ({ db, userId }) => {
    await requireCreator(db, projectId, userId);
    await regenerateInvite(db, projectId);
  });
}

export async function addDeviceParticipantAction(projectId: string, name: string) {
  return run(async ({ db, userId }) => {
    const id = await addDeviceParticipant(db, userId, projectId, name);
    return { participantId: id };
  });
}

export async function removeParticipantAction(projectId: string, participantId: string) {
  return run(async ({ db, userId }) => {
    await removeParticipant(db, userId, projectId, participantId);
  });
}

export async function startOverAction(participantId: string) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await startOver(db, participantId);
  });
}

export async function deleteProjectAction(projectId: string) {
  const result = await run(async ({ db, userId }) => {
    await requireCreator(db, projectId, userId);
    await deleteProject(db, projectId);
  });
  if (result.ok) redirect('/projects');
  return result;
}
