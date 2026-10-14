import { NextResponse } from 'next/server';
import { submitThrow } from '@/lib/brock-service';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { readJson, ThrowBody } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const player = await requirePlayer();

    const body = ThrowBody.safeParse(await readJson(request));
    if (!body.success) throw new DomainError('invalid_request');

    const result = await submitThrow(player.id, body.data);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
