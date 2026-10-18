import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { reportImageFailure } from '@/lib/images/check';
import { allow } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const body = z.object({ itemId: z.string().min(1).max(64) });

/** A browser couldn't load a card's image. Two reports retire the item (R33). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const db = await getDb();
  // One person can't retire a card on their own: limit how often one session may report.
  if (!(await allow(db, `report:${user.id}:${parsed.data.itemId}`, 1, 24 * 3_600_000))) {
    return NextResponse.json({ ok: true });
  }
  await reportImageFailure(db, parsed.data.itemId);
  return NextResponse.json({ ok: true });
}
