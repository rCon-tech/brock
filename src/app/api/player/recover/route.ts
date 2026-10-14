import { NextResponse } from 'next/server';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { recoverPlayer } from '@/lib/players';
import { setIdentityCookie } from '@/lib/session';
import { readJson, RecoverBody } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Restores a named player on this browser. Rotates their recovery code, which is returned once. */
export async function POST(request: Request) {
  try {
    const body = RecoverBody.safeParse(await readJson(request));
    if (!body.success) throw new DomainError('invalid_request');

    const { player, token, recoveryCode } = await recoverPlayer(body.data.handle, body.data.code);
    await setIdentityCookie(token);
    return NextResponse.json(
      { handle: player.handle, recoveryCode },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
