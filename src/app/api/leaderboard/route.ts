import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { getCurrentPlayer } from '@/lib/session';
import { clampLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const param = new URL(request.url).searchParams.get('limit');
    const raw = param === null || param.trim() === '' ? NaN : Number(param);
    const limit = clampLimit(Number.isFinite(raw) ? Math.trunc(raw) : 100);

    const me = await getCurrentPlayer().catch(() => null);
    const [entries, standing] = await Promise.all([
      topPlayers(limit),
      me ? rankOf(me.id) : Promise.resolve(null),
    ]);

    // Anonymous responses are safe to share at the edge. Responses for a known player carry `me`, so they
    // must not be stored by shared caches.
    const cache = me ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=60';

    return NextResponse.json(
      { entries, ...(me && { me: standing }) },
      { headers: { 'Cache-Control': cache, Vary: 'Cookie' } },
    );
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
