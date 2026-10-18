import { NextResponse } from 'next/server';
import { startRisk } from '@/lib/brock-service';
import { toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Risks the run on one more Brock: win to carry on, lose and the day scores 0. */
export async function POST(request: Request) {
  try {
    await readJson(request);
    const player = await requirePlayer();
    const state = await startRisk(player.id);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
