import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { commit } from '../../src/lib/fairness';
import { hashToken } from '../../src/lib/identity';

/*
 * The House throws at random, so these tests reach into the test database to set the scene:
 * put a player on a streak, rig the House's throw, and read the lifeline's answer.
 */
const sql = postgres(
  process.env.TEST_DATABASE_URL ?? 'postgres://brock:brock@localhost:5433/brock_test',
  { max: 2, onnotice: () => {} },
);
test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});

const utc = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Creates this browser's player (first visit) and returns its id. */
async function playerIn(context: BrowserContext): Promise<string> {
  await context.request.get('/api/brock/today');
  const cookie = (await context.cookies()).find((c) => c.name === 'brock_id');
  const [row] =
    await sql`SELECT player_id FROM player_session WHERE token_hash = ${hashToken(cookie!.value)}`;
  return row.player_id;
}

async function putOnStreak(playerId: string, streak: number) {
  await sql`UPDATE player SET current_streak = ${streak}, best_streak = ${streak}, last_win_day = ${utc(-1)} WHERE id = ${playerId}`;
}

/** Fixes the House's throw for the open round (and re-commits to it). */
async function rigHouse(playerId: string, house: 'rock' | 'paper' | 'scissors') {
  const [round] = await sql`
    SELECT r.id, r.salt FROM brock_round r JOIN brock b ON b.id = r.brock_id
    WHERE b.player_id = ${playerId} AND b.day = ${utc()} AND r.player_throw IS NULL`;
  await sql`UPDATE brock_round SET house_throw = ${house}, commit_hash = ${commit(house, round.salt)} WHERE id = ${round.id}`;
}

async function answerIndex(playerId: string): Promise<number> {
  const [row] = await sql`
    SELECT x.answer_index FROM brock_rescue x JOIN brock b ON b.id = x.brock_id
    WHERE b.player_id = ${playerId} AND b.day = ${utc()}`;
  return row.answer_index;
}

const streakCaption = (page: Page, n: number) =>
  page.getByLabel(new RegExp(`^Current streak ${n}, best streak \\d+$`));

/** A player on a 3-day streak who has just lost today's Brock. */
async function loseAStreak(context: BrowserContext, page: Page) {
  const id = await playerIn(context);
  await putOnStreak(id, 3);
  await rigHouse(id, 'paper');
  await page.goto('/');
  await expect(streakCaption(page, 3)).toBeVisible();
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('THE HOUSE WINS');
  return id;
}

test('losing a streak offers a lifeline; a right answer earns another Brock that saves it', async ({
  context,
  page,
}) => {
  const id = await loseAStreak(context, page);

  // The lifeline replaces "see you tomorrow" until it's settled.
  await expect(page.getByText('LIFELINE!')).toBeVisible();
  await expect(page.getByText('See you tomorrow!')).toHaveCount(0);

  await page.getByRole('button', { name: 'TAKE THE QUESTION' }).click();
  const card = page.getByTestId('lifeline-question');
  await expect(card).toBeVisible();
  const answers = card.getByRole('group', { name: 'Answers' }).getByRole('button');
  await expect(answers).toHaveCount(4);
  await expect(card.getByLabel(/^1[45] seconds left$/)).toBeVisible();

  await answers.nth(await answerIndex(id)).click();

  // Streak restored and a fresh round to play.
  await expect(page.getByTestId('lifeline-verdict')).toHaveText('CORRECT!');
  await expect(streakCaption(page, 3)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toBeVisible();

  await rigHouse(id, 'scissors');
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('YOU WIN!');
  await expect(streakCaption(page, 4)).toBeVisible();
  await expect(page.getByText('Saved by the lifeline!')).toBeVisible();
  await expect(page.getByText('Come back tomorrow to keep your streak going.')).toBeVisible();
});

test('a wrong answer ends the streak and shows the right answer', async ({ context, page }) => {
  const id = await loseAStreak(context, page);
  await page.getByRole('button', { name: 'TAKE THE QUESTION' }).click();
  const answers = page
    .getByTestId('lifeline-question')
    .getByRole('group', { name: 'Answers' })
    .getByRole('button');
  const right = await answerIndex(id);
  await answers.nth((right + 1) % 4).click();

  await expect(page.getByTestId('lifeline-verdict')).toHaveText('WRONG!');
  await expect(page.getByText('(correct answer)')).toHaveCount(1);
  await expect(page.getByText('Your streak of 3 is over.')).toBeVisible();
  await expect(page.getByText('See you tomorrow!')).toBeVisible();
  await expect(streakCaption(page, 0)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);
});

test('reloading mid-question shows the same question with the clock still running', async ({
  context,
  page,
}) => {
  await loseAStreak(context, page);
  await page.getByRole('button', { name: 'TAKE THE QUESTION' }).click();
  const question = await page.getByTestId('lifeline-question').getByRole('heading').textContent();

  await page.waitForTimeout(2500);
  await page.reload();
  const card = page.getByTestId('lifeline-question');
  await expect(card.getByRole('heading')).toHaveText(question!);
  await expect(card.getByLabel(/^1[0-3] seconds left$/)).toBeVisible();
});

test('losing with no streak offers no lifeline', async ({ context, page }) => {
  const id = await playerIn(context);
  await rigHouse(id, 'paper');
  await page.goto('/');
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('THE HOUSE WINS');
  await expect(page.getByText('See you tomorrow!')).toBeVisible();
  await expect(page.getByText('LIFELINE!')).toHaveCount(0);
});
