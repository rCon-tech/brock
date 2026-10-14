import { NextResponse } from 'next/server';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { claimHandle } from '@/lib/players';
import { requirePlayer } from '@/lib/session';
import { ClaimHandleBody, readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Names the current player. */
export async function POST(request: Request) {
  try {
    const me = await requirePlayer();
    const body = ClaimHandleBody.safeParse(await readJson(request));
    if (!body.success) {
      throw new DomainError('invalid_request', body.error.issues[0]?.message);
    }

    const player = await claimHandle(me.id, body.data.handle);
    return NextResponse.json(
      { handle: player.handle },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
