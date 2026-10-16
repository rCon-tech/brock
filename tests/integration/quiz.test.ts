import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { answerQuiz, getToday, startQuiz } from '@/lib/brock-service';
import { DomainError } from '@/lib/errors';
import { QUESTION_SECONDS, QUIZ_GRACE_MS, QUIZ_LENGTH } from '@/lib/trivia/quiz';
import { createPlayer } from './setup';
import { at, draw, lose, playerRow, quizRow, win } from './helpers';

const { brockQuiz } = schema;

const D1 = '2026-11-01';
const D2 = '2026-11-02';
const T0 = at(D1, '10:00:00');
/** `ms` after the start of the quiz on D1. */
const after = (ms: number) => new Date(T0.getTime() + ms);

/** A player whose run of 2 has just ended on D1. */
async function lostRun() {
  const id = await createPlayer('rich');
  await win(id, at(D1, '09:00:00'));
  await win(id, at(D1, '09:00:01'));
  await lose(id, at(D1, '09:00:02'));
  return id;
}

/**
 * Answers every remaining question, one second apart from `start`: right unless its position is
 * in `wrong`. Returns the final state and the time of the last answer.
 */
async function answerAll(id: string, wrong: number[] = [], start = T0.getTime()) {
  const row = (await quizRow(id, T0))!;
  let state = await getToday(id, new Date(start));
  let now = start;
  for (let i = row.currentIndex; i < row.items.length; i++) {
    now += 1000;
    const item = row.items[i];
    const choice = wrong.includes(i) ? (item.answerIndex + 1) % 4 : item.answerIndex;
    state = await answerQuiz(id, { index: i, choice }, new Date(now));
  }
  return { state, now };
}

describe('startQuiz', () => {
  it('starts five questions, shows the first with a 15-second clock and no answers', async () => {
    const id = await lostRun();
    const state = await startQuiz(id, T0);

    expect(state.quizAvailable).toBe(false);
    expect(state.quiz).toMatchObject({
      status: 'active',
      index: 0,
      total: QUIZ_LENGTH,
      msLeft: QUESTION_SECONDS * 1000,
    });
    if (state.quiz?.status !== 'active') throw new Error('expected an active quiz');
    expect(['rock', 'paper', 'scissors']).toContain(state.quiz.theme);
    expect(state.quiz.options).toHaveLength(4);
    expect(state.quiz.question).toMatch(/\?$/);
    expect(Object.keys(state.quiz).sort()).toEqual(
      ['index', 'msLeft', 'options', 'question', 'status', 'theme', 'total'].sort(),
    );
    expect(JSON.stringify(state)).not.toMatch(/answerIndex|correct/i);
  });

  it('covers all three themes with five different questions', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    const ids = row.items.map((i) => i.questionId);

    expect(new Set(ids).size).toBe(QUIZ_LENGTH);
    expect(new Set(ids.map((q) => q.split('-')[0]))).toEqual(
      new Set(['rock', 'paper', 'scissors']),
    );
  });

  it('cannot be rerolled: starting again returns the same question with less time', async () => {
    const id = await lostRun();
    const first = await startQuiz(id, T0);
    const again = await startQuiz(id, after(4000));

    expect(again.quiz).toMatchObject({ index: 0, msLeft: 11_000 });
    if (first.quiz?.status !== 'active' || again.quiz?.status !== 'active') throw new Error();
    expect(again.quiz.question).toBe(first.quiz.question);
    expect(again.quiz.options).toEqual(first.quiz.options);
    expect(await getDb().select().from(brockQuiz)).toHaveLength(1);
  });

  it('refuses while the run is still going', async () => {
    const id = await createPlayer('rich');
    await win(id, at(D1));
    await expect(startQuiz(id, T0)).rejects.toMatchObject({ code: 'no_quiz' });
  });

  it('refuses before today’s run exists', async () => {
    const id = await createPlayer('rich');
    await expect(startQuiz(id, T0)).rejects.toMatchObject({ code: 'new_day' });
  });

  it('prefers questions the player has not seen on earlier days', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const day1 = (await quizRow(id, T0))!.items.map((i) => i.questionId);

    await lose(id, at(D2));
    await startQuiz(id, at(D2));
    const day2 = (await quizRow(id, at(D2)))!.items.map((i) => i.questionId);

    expect(day2.filter((q) => day1.includes(q))).toEqual([]);
  });

  it('is safe under concurrent starts: one quiz', async () => {
    const id = await lostRun();
    const states = await Promise.all(Array.from({ length: 5 }, () => startQuiz(id, T0)));
    const questions = new Set(
      states.map((s) => (s.quiz?.status === 'active' ? s.quiz.question : '')),
    );
    expect(questions.size).toBe(1);
    expect(await getDb().select().from(brockQuiz)).toHaveLength(1);
  });
});

describe('answerQuiz', () => {
  it('moves to the next question without saying right or wrong', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    const state = await answerQuiz(
      id,
      { index: 0, choice: (row.items[0].answerIndex + 1) % 4 },
      after(3000),
    );

    expect(state.status).toBe('over');
    expect(state.quiz).toMatchObject({ status: 'active', index: 1, msLeft: 15_000 });
    expect(JSON.stringify(state)).not.toMatch(/answerIndex|correct/i);
  });

  it('five out of five wins a life: the run reopens with its score kept', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const { state } = await answerAll(id);

    expect(state).toMatchObject({
      status: 'playing',
      score: 2,
      quizAvailable: false,
      quiz: { status: 'passed', correctCount: 5, total: 5 },
    });
    expect(state.openRound).toMatchObject({ roundNo: 4 });
  });

  it('after the extra life, wins keep adding to the same run and the best', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    await answerAll(id);
    await win(id, at(D1, '11:00:00'));
    const result = await win(id, at(D1, '11:00:01'));

    expect(result).toMatchObject({ status: 'playing', score: 4, best: 4 });
    expect((await playerRow(id)).bestScore).toBe(4);
  });

  it('losing again after the extra life ends the run for good: one quiz a day', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    await answerAll(id);
    await draw(id, at(D1, '11:00:00'));
    const result = await lose(id, at(D1, '11:00:01'));

    expect(result).toMatchObject({ status: 'over', score: 2, quizAvailable: false });
    expect(result.quiz?.status).toBe('passed');
    // Starting again just returns the finished quiz: no new questions.
    const again = await startQuiz(id, at(D1, '11:00:02'));
    expect(again).toMatchObject({ status: 'over', quiz: { status: 'passed' } });
    expect(await getDb().select().from(brockQuiz)).toHaveLength(1);
  });

  it('four out of five is not enough, and reveals every answer at the end', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    const { state } = await answerAll(id, [4]);

    expect(state).toMatchObject({
      status: 'over',
      openRound: null,
      quizAvailable: false,
      quiz: { status: 'failed', correctCount: 4, total: 5 },
    });
    if (state.quiz?.status !== 'failed') throw new Error();
    expect(state.quiz.results.map((r) => r.correctIndex)).toEqual(
      row.items.map((i) => i.answerIndex),
    );
    expect(state.quiz.results[4].chosenIndex).toBe((row.items[4].answerIndex + 1) % 4);
    expect(state.quiz.results[0].chosenIndex).toBe(row.items[0].answerIndex);
  });

  it('a wrong first answer still plays all five before the reveal', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const { state } = await answerAll(id, [0]);
    expect(state.quiz).toMatchObject({ status: 'failed', correctCount: 4 });
  });

  it('a right answer after the clock (plus grace) counts as wrong', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    const late = QUESTION_SECONDS * 1000 + QUIZ_GRACE_MS + 1;
    await answerQuiz(id, { index: 0, choice: row.items[0].answerIndex }, after(late));

    expect((await quizRow(id, T0))!.items[0].chosenIndex).toBeNull();
    const { state } = await answerAll(id, [], T0.getTime() + late);
    expect(state.quiz).toMatchObject({ status: 'failed', correctCount: 4 });
  });

  it('a right answer just inside the grace period still counts', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    const justInTime = QUESTION_SECONDS * 1000 + QUIZ_GRACE_MS;
    await answerQuiz(id, { index: 0, choice: row.items[0].answerIndex }, after(justInTime));

    const { state } = await answerAll(id, [], T0.getTime() + justInTime);
    expect(state.quiz).toMatchObject({ status: 'passed' });
  });

  it('each question gets its own 15 seconds from when it appears', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    await answerQuiz(id, { index: 0, choice: row.items[0].answerIndex }, after(14_000));
    // 28s after the start, but only 14s into question 2.
    await answerQuiz(id, { index: 1, choice: row.items[1].answerIndex }, after(28_000));

    const updated = (await quizRow(id, T0))!;
    expect(updated.items[1].chosenIndex).toBe(row.items[1].answerIndex);
  });

  it('an abandoned question is closed as wrong on the next visit, and the next one starts', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const state = await getToday(id, after(60_000));

    expect(state.quiz).toMatchObject({ status: 'active', index: 1, msLeft: 15_000 });
    expect((await quizRow(id, T0))!.items[0].chosenIndex).toBeNull();
  });

  it('abandoning the last question fails the quiz', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const row = (await quizRow(id, T0))!;
    for (let i = 0; i < 4; i++) {
      await answerQuiz(id, { index: i, choice: row.items[i].answerIndex }, after(i * 1000 + 1000));
    }
    const state = await getToday(id, after(60_000));

    expect(state).toMatchObject({
      status: 'over',
      quiz: { status: 'failed', correctCount: 4 },
    });
  });

  it('rejects an answer for the wrong question (stale_question)', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    await expect(answerQuiz(id, { index: 1, choice: 0 }, after(1000))).rejects.toMatchObject({
      code: 'stale_question',
    });
    await answerQuiz(id, { index: 0, choice: 0 }, after(1000));
    await expect(answerQuiz(id, { index: 0, choice: 0 }, after(2000))).rejects.toMatchObject({
      code: 'stale_question',
    });
  });

  it('rejects answers before the quiz starts or after it ends', async () => {
    const id = await lostRun();
    await expect(answerQuiz(id, { index: 0, choice: 0 }, T0)).rejects.toMatchObject({
      code: 'no_quiz',
    });
    await startQuiz(id, T0);
    const { now } = await answerAll(id, [2]);
    await expect(
      answerQuiz(id, { index: 4, choice: 0 }, new Date(now + 1000)),
    ).rejects.toMatchObject({ code: 'quiz_closed' });
  });

  it('counts only one of several simultaneous answers to the same question', async () => {
    const id = await lostRun();
    await startQuiz(id, T0);
    const outcomes = await Promise.allSettled(
      [0, 1, 2, 3].map((choice) => answerQuiz(id, { index: 0, choice }, after(2000))),
    );

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    for (const o of outcomes) {
      if (o.status === 'rejected') {
        expect(o.reason).toBeInstanceOf(DomainError);
        expect((o.reason as DomainError).code).toBe('stale_question');
      }
    }
    expect((await quizRow(id, T0))!.currentIndex).toBe(1);
  });
});
