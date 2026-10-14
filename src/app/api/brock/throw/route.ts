import { NextResponse } from 'next/server';
import { submitThrow } from '@/lib/brock-service';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { ThrowBody } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { player } = await requirePlayer();

    const json = await request.json().catch(() => null);
    const body = ThrowBody.safeParse(json);
    if (!body.success) throw new DomainError('invalid_request');

    const result = await submitThrow(player.userId, body.data);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
