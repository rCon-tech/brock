import { NextResponse } from 'next/server';
import { getToday } from '@/lib/brock-service';
import { toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { player } = await requirePlayer();
    const state = await getToday(player.userId);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
