import { NextResponse } from 'next/server';
import { startRescue } from '@/lib/brock-service';
import { toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Reveals today's lifeline question and starts its clock. */
export async function POST(request: Request) {
  try {
    await readJson(request);
    const player = await requirePlayer();
    const state = await startRescue(player.id);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
