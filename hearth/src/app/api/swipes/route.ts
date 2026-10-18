import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { AppError } from '@/lib/errors';
import { requireHost } from '@/lib/permissions';
import { enforce, LIMITS } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';
import { recordSwipes, recordVeto, swipeInput, undoSwipe } from '@/lib/swipes';

export const dynamic = 'force-dynamic';

const MAX_OPS = 100;

const body = z.object({
  participantId: z.string().min(1).max(64),
  ops: z
    .array(
      z.discriminatedUnion('type', [
        swipeInput.extend({ type: z.literal('swipe') }),
        z.object({ type: z.literal('undo'), itemId: z.string().min(1).max(64) }),
        z.object({
          type: z.literal('veto'),
          clientId: z.string().min(8).max(64),
          itemId: z.string().min(1).max(64),
          attribute: z.string().max(64).nullish(),
        }),
      ]),
    )
    .max(MAX_OPS),
});

/**
 * Applies a batch from the phone's offline queue, in order. Individual problems (a stale card, no
 * vetoes left) are reported back rather than failing the batch, so one bad entry can never wedge
 * the queue.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError('Not found', 404);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('Bad request', 400);
    const { participantId, ops } = parsed.data;
    const db = await getDb();
    await requireHost(db, participantId, user.id);
    await enforce(db, `swipes:${participantId}`, LIMITS.swipes.limit, LIMITS.swipes.windowMs);

    let saved = 0;
    const rejected: string[] = [];
    const problems: string[] = [];
    let run: Extract<(typeof ops)[number], { type: 'swipe' }>[] = [];
    const flushRun = async () => {
      if (run.length === 0) return;
      const result = await recordSwipes(db, participantId, run);
      saved += result.saved;
      rejected.push(...result.rejected);
      run = [];
    };
    for (const op of ops) {
      if (op.type === 'swipe') {
        run.push(op);
        continue;
      }
      await flushRun();
      try {
        if (op.type === 'undo') await undoSwipe(db, participantId, op.itemId);
        else await recordVeto(db, participantId, op);
      } catch (error) {
        if (error instanceof AppError) problems.push(error.message);
        else throw error;
      }
    }
    await flushRun();
    return NextResponse.json({ saved, rejected, problems });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
