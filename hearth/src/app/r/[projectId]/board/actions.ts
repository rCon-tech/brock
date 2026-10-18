'use server';

import { redirect } from 'next/navigation';
import { run } from '@/lib/action';
import { AppError } from '@/lib/errors';
import { submitFeedback } from '@/lib/board';
import { requireCreator, requireHost } from '@/lib/permissions';
import { createNextRoom } from '@/lib/projects';
import { enforce, LIMITS } from '@/lib/rate-limit';
import { react } from '@/lib/reactions';
import { setBought, setSaved } from '@/lib/shopping';
import { swapPick, undoSwap } from '@/lib/swap';
import { startTiebreak } from '@/lib/tiebreak';
import { ROOM_TYPES } from '@/lib/taxonomy';

type Reaction = 'love' | 'unsure' | 'no' | null;

export async function reactAction(
  participantId: string,
  itemId: string,
  reaction: Reaction,
  note?: string,
) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await enforce(db, `react:${participantId}`, LIMITS.reactions.limit, LIMITS.reactions.windowMs);
    await react(db, participantId, itemId, { reaction, note });
  });
}

export async function swapAction(participantId: string, itemId: string) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    return swapPick(db, participantId, itemId);
  });
}

export async function undoSwapAction(participantId: string, swapId: string) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await undoSwap(db, participantId, swapId);
  });
}

export async function startTiebreakAction(projectId: string, participantId: string) {
  const result = await run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await startTiebreak(db, projectId);
  });
  if (result.ok) redirect(`/r/${projectId}/tiebreak?as=${participantId}`);
  return result;
}

export async function savedAction(participantId: string, itemId: string, saved: boolean) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await setSaved(db, participantId, itemId, saved);
  });
}

export async function boughtAction(participantId: string, itemId: string, bought: boolean) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await setBought(db, participantId, itemId, bought);
  });
}

export async function feedbackAction(participantId: string, helpful: boolean) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await submitFeedback(db, participantId, helpful);
  });
}

export async function nextRoomAction(projectId: string, roomType: string) {
  const result = await run(async ({ db, userId }) => {
    await requireCreator(db, projectId, userId);
    if (!(ROOM_TYPES as readonly string[]).includes(roomType)) throw new AppError('Unknown room');
    return createNextRoom(db, userId, projectId, roomType as (typeof ROOM_TYPES)[number]);
  });
  if (result.ok) redirect(`/r/${result.data.projectId}/swipe`);
  return result;
}
