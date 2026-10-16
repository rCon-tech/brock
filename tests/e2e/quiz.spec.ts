import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { playerIn, playRun, quizAnswer, rigHouse, scoreCaption, closeDb } from './db';

test.afterAll(closeDb);

/** A player whose run of 2 has just ended, with the quiz on offer. */
async function loseARun(context: BrowserContext, page: Page) {
  const id = await playerIn(context);
  await page.goto('/');
  await playRun(page, id, 2);
  await expect(page.getByText('ONE MORE LIFE?')).toBeVisible();
  return id;
}

/** Answers question `index` (0-based), right or wrong. */
async function answer(page: Page, id: string, index: number, right: boolean) {
  const card = page.getByTestId('quiz-question');
  await expect(card.getByText(`Question ${index + 1} of 5`)).toBeVisible();
  const correct = await quizAnswer(id, index);
  await card
    .getByRole('group', { name: 'Answers' })
    .getByRole('button')
    .nth(right ? correct : (correct + 1) % 4)
    .click();
}

test('five right answers win another life, and the run carries on from its score', async ({
  context,
  page,
}) => {
  const id = await loseARun(context, page);
  await page.getByRole('button', { name: 'WIN ANOTHER LIFE' }).click();

  const card = page.getByTestId('quiz-question');
  await expect(card.getByRole('group', { name: 'Answers' }).getByRole('button')).toHaveCount(4);
  await expect(card.getByLabel(/^1[45] seconds left$/)).toBeVisible();
  await expect(card.getByText(/(ROCK|PAPER|SCISSORS)$/)).toBeVisible();
  // The question has the screen to itself.
  await expect(page.getByTestId('outcome')).toHaveCount(0);

  for (let i = 0; i < 5; i++) await answer(page, id, i, true);

  await expect(page.getByTestId('quiz-verdict')).toHaveText('ANOTHER LIFE!');
  await expect(scoreCaption(page, 2)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toBeVisible();

  await rigHouse(id, 'scissors');
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('YOU WIN!');
  await expect(scoreCaption(page, 3)).toBeVisible();

  // Losing again ends the day: the quiz is once a day.
  await page.getByRole('button', { name: 'BROCK', exact: true }).click();
  await rigHouse(id, 'paper');
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('THE HOUSE WINS');
  await expect(page.getByText('You’ve used today’s extra life.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'WIN ANOTHER LIFE' })).toHaveCount(0);
  await expect(page.getByText('See you tomorrow!')).toBeVisible();
});

test('one wrong answer is only revealed at the end, and costs the life', async ({
  context,
  page,
}) => {
  const id = await loseARun(context, page);
  await page.getByRole('button', { name: 'WIN ANOTHER LIFE' }).click();

  await answer(page, id, 0, false);
  // No hint after a wrong answer: straight on to question 2.
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
  for (let i = 1; i < 5; i++) await answer(page, id, i, true);

  await expect(page.getByTestId('quiz-verdict')).toHaveText('4 OUT OF 5');
  await expect(page.getByText('(correct answer)')).toHaveCount(5);
  await expect(page.getByText('(your answer)')).toHaveCount(1);
  await expect(page.getByText('See you tomorrow!')).toBeVisible();
  await expect(scoreCaption(page, 2)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);

  // Reloading keeps the result: no second try.
  await page.reload();
  await expect(page.getByTestId('quiz-verdict')).toHaveText('4 OUT OF 5');
  await expect(page.getByRole('button', { name: 'WIN ANOTHER LIFE' })).toHaveCount(0);
});

test('reloading mid-question shows the same question with the clock still running', async ({
  context,
  page,
}) => {
  const id = await loseARun(context, page);
  await page.getByRole('button', { name: 'WIN ANOTHER LIFE' }).click();
  await answer(page, id, 0, true);

  const card = page.getByTestId('quiz-question');
  await expect(card.getByText('Question 2 of 5')).toBeVisible();
  const question = await card.getByRole('heading').textContent();
  await page.waitForTimeout(2500);
  await page.reload();

  await expect(card.getByText('Question 2 of 5')).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText(question!);
  await expect(card.getByLabel(/^1[0-3] seconds left$/)).toBeVisible();
});
