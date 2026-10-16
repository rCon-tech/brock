import { NextResponse } from 'next/server';
import { answerRescue } from '@/lib/brock-service';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { readJson, RescueAnswerBody } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Answers the lifeline question. A right answer in time reopens today's Brock. */
export async function POST(request: Request) {
  try {
    const body = RescueAnswerBody.safeParse(await readJson(request));
    if (!body.success) throw new DomainError('invalid_request');
    const player = await requirePlayer();
    const result = await answerRescue(player.id, body.data.choice);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
