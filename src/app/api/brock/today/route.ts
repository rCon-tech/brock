import { NextResponse } from 'next/server';
import { getToday } from '@/lib/brock-service';
import { toErrorResponse } from '@/lib/errors';
import { getOrCreatePlayer } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** First call from a new browser also creates its anonymous player and sets the identity cookie. */
export async function GET() {
  try {
    const player = await getOrCreatePlayer();
    const state = await getToday(player.id);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
