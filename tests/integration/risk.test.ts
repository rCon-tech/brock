import { describe, expect, it } from 'vitest';
import { answerQuiz, getToday, startQuiz, startRisk } from '@/lib/brock-service';
import { createPlayer } from './setup';
import { at, draw, lose, playerRow, quizRow, win } from './helpers';

const D0 = '2026-10-31';
const D1 = '2026-11-01';
const t = (time: string) => at(D1, time);

/** Answers all five questions right, starting at `start`. */
async function passQuiz(id: string, start: Date) {
  await startQuiz(id, start);
  const row = (await quizRow(id, start))!;
  for (let i = 0; i < row.items.length; i++) {
    await answerQuiz(
      id,
      { index: i, choice: row.items[i].answerIndex },
      new Date(start.getTime() + (i + 1) * 1000),
    );
  }
}

/** Fails the quiz on its first question. */
async function failQuiz(id: string, start: Date) {
  await startQuiz(id, start);
  const row = (await quizRow(id, start))!;
  for (let i = 0; i < row.items.length; i++) {
    const right = row.items[i].answerIndex;
    await answerQuiz(
      id,
      { index: i, choice: i === 0 ? (right + 1) % 4 : right },
      new Date(start.getTime() + (i + 1) * 1000),
    );
  }
}

/** Run of 2, lost, life won in the quiz, one more win (3), lost again: the risk is on offer. */
async function readyToRisk() {
  const id = await createPlayer('rich');
  await win(id, t('09:00:00'));
  await win(id, t('09:00:01'));
  await lose(id, t('09:00:02'));
  await passQuiz(id, t('09:01:00'));
  await win(id, t('09:02:00'));
  const lost = await lose(id, t('09:02:01'));
  return { id, lost };
}

describe('when the risk is offered', () => {
  it('after the quiz’s extra life is won and then lost too', async () => {
    const { lost } = await readyToRisk();
    expect(lost).toMatchObject({
      status: 'over',
      score: 3,
      quizAvailable: false,
      riskAvailable: true,
      risk: null,
    });
  });

  it('not on the first loss of the day (that’s the quiz’s turn)', async () => {
    const id = await createPlayer('rich');
    expect(await lose(id, t('09:00:00'))).toMatchObject({
      quizAvailable: true,
      riskAvailable: false,
    });
    await expect(startRisk(id, t('09:00:01'))).rejects.toMatchObject({ code: 'no_risk' });
  });

  it('not after a failed quiz', async () => {
    const id = await createPlayer('rich');
    await lose(id, t('09:00:00'));
    await failQuiz(id, t('09:01:00'));
    expect(await getToday(id, t('09:02:00'))).toMatchObject({
      quiz: { status: 'failed' },
      riskAvailable: false,
    });
    await expect(startRisk(id, t('09:02:00'))).rejects.toMatchObject({ code: 'no_risk' });
  });

  it('not while the run is still going', async () => {
    const id = await createPlayer('rich');
    await win(id, t('09:00:00'));
    await expect(startRisk(id, t('09:00:01'))).rejects.toMatchObject({ code: 'no_risk' });
  });
});

describe('startRisk', () => {
  it('reopens the run with a fresh round, keeping the score', async () => {
    const { id } = await readyToRisk();
    const state = await startRisk(id, t('09:03:00'));

    expect(state).toMatchObject({
      status: 'playing',
      score: 3,
      risk: 'active',
      riskAvailable: false,
    });
    expect(state.openRound).toMatchObject({ roundNo: state.rounds.length + 1 });
  });

  it('can only be taken once', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    await expect(startRisk(id, t('09:03:01'))).rejects.toMatchObject({ code: 'no_risk' });
  });
});

describe('the risked Brock', () => {
  it('a win carries the run on from the same score, without adding a point', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    const result = await win(id, t('09:03:01'));

    expect(result).toMatchObject({
      status: 'playing',
      score: 3,
      risk: 'survived',
      risked: true,
      round: { result: 'win' },
    });
    expect(result.openRound).not.toBeNull();
  });

  it('after surviving, wins score again as normal', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    await win(id, t('09:03:01'));
    const result = await win(id, t('09:03:02'));

    expect(result).toMatchObject({ score: 4, best: 4, risked: false });
    expect((await playerRow(id)).bestScore).toBe(4);
  });

  it('after surviving, the next loss ends the day for good', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    await win(id, t('09:03:01'));
    const result = await lose(id, t('09:03:02'));

    expect(result).toMatchObject({
      status: 'over',
      score: 3,
      risked: false,
      risk: 'survived',
      riskAvailable: false,
      quizAvailable: false,
    });
  });

  it('a draw is a free re-throw: still at risk', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    const result = await draw(id, t('09:03:01'));

    expect(result).toMatchObject({ status: 'playing', score: 3, risk: 'active', risked: true });
  });

  it('a loss drops the day’s score to 0', async () => {
    const { id } = await readyToRisk();
    await startRisk(id, t('09:03:00'));
    const result = await lose(id, t('09:03:01'));

    expect(result).toMatchObject({
      status: 'over',
      score: 0,
      risk: 'lost',
      risked: true,
      riskAvailable: false,
    });
  });

  it('a loss takes today’s run off the best score, back to the best other day', async () => {
    const id = await createPlayer('rich');
    // Best before today: 2.
    await win(id, at(D0));
    await win(id, at(D0, '10:00:01'));
    await lose(id, at(D0, '10:00:02'));
    // Today reaches 3 (a new best) before the risk.
    for (const s of ['00', '01', '02']) await win(id, t(`09:00:${s}`));
    await lose(id, t('09:00:03'));
    await passQuiz(id, t('09:01:00'));
    await lose(id, t('09:02:00'));
    expect((await playerRow(id)).bestScore).toBe(3);

    await startRisk(id, t('09:03:00'));
    const result = await lose(id, t('09:03:01'));
    expect(result).toMatchObject({ score: 0, best: 2 });
    expect((await playerRow(id)).bestScore).toBe(2);
  });
});
