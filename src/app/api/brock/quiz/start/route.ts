import { NextResponse } from 'next/server';
import { startQuiz } from '@/lib/brock-service';
import { toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Starts today's "win another life" quiz, or returns it where it stands. */
export async function POST(request: Request) {
  try {
    await readJson(request);
    const player = await requirePlayer();
    const state = await startQuiz(player.id);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
