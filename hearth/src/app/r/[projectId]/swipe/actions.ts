'use server';

import { run } from '@/lib/action';
import { requireHost } from '@/lib/permissions';
import { afterFinished } from '@/lib/reveal';
import { finishRound } from '@/lib/swipes';
import { afterBridgeSwipes } from '@/lib/tiebreak';
import { scheduleNaming } from '../actions';

/** Marks a round finished once the phone has saved every swipe. Finishing the last one may reveal. */
export async function finishRoundAction(
  projectId: string,
  participantId: string,
  round: 'macro' | 'micro',
) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    await finishRound(db, participantId, round);
    if (round === 'micro') {
      const out = await afterFinished(db, projectId);
      if (out && 'version' in out) await scheduleNaming(db, projectId, out.version);
    }
  });
}

export async function finishTiebreakAction(projectId: string, participantId: string) {
  return run(async ({ db, userId }) => {
    await requireHost(db, participantId, userId);
    const out = await afterBridgeSwipes(db, projectId);
    if (out.rebuilt) await scheduleNaming(db, projectId, out.version);
  });
}
