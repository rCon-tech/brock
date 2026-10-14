import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { logInAs } from '@/lib/players';
import { allow } from '@/lib/rate-limit';
import { setIdentityCookie } from '@/lib/session';
import { LoginBody, readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const LOGINS_PER_IP = 30;
const LOGIN_WINDOW_MS = 15 * 60_000;

/** Logs this browser in as an existing player, by handle alone. */
export async function POST(request: Request) {
  try {
    const body = LoginBody.safeParse(await readJson(request));
    if (!body.success) throw new DomainError('invalid_request');

    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!allow(`login:${ip}`, LOGINS_PER_IP, LOGIN_WINDOW_MS))
      throw new DomainError('rate_limited');

    const { player, token } = await logInAs(body.data.handle);
    await setIdentityCookie(token);
    return NextResponse.json(
      { handle: player.handle },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
