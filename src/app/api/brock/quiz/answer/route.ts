import { NextResponse } from 'next/server';
import { answerQuiz } from '@/lib/brock-service';
import { DomainError, toErrorResponse } from '@/lib/errors';
import { requirePlayer } from '@/lib/session';
import { QuizAnswerBody, readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Answers the current quiz question. Five right answers out of five revive today's run. */
export async function POST(request: Request) {
  try {
    const body = QuizAnswerBody.safeParse(await readJson(request));
    if (!body.success) throw new DomainError('invalid_request');
    const player = await requirePlayer();
    const state = await answerQuiz(player.id, body.data);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
