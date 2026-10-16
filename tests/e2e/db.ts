import { expect, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { commit } from '../../src/lib/fairness';
import { hashToken } from '../../src/lib/identity';

/*
 * The House throws at random, so tests reach into the test database to set the scene: rig the
 * House's next throw, and read the quiz's answers.
 */
let client: postgres.Sql | undefined;

/** One connection per spec file: each file closes it in `afterAll` with `closeDb`. */
function sql(strings: TemplateStringsArray, ...values: postgres.ParameterOrFragment<never>[]) {
  client ??= postgres(
    process.env.TEST_DATABASE_URL ?? 'postgres://brock:brock@localhost:5433/brock_test',
    { max: 2, onnotice: () => {} },
  );
  return client(strings, ...values);
}

export async function closeDb() {
  await client?.end({ timeout: 5 });
  client = undefined;
}

const utc = () => new Date().toISOString().slice(0, 10);

/** Creates this browser's player (first visit) and returns its id. */
export async function playerIn(context: BrowserContext): Promise<string> {
  await context.request.get('/api/brock/today');
  const cookie = (await context.cookies()).find((c) => c.name === 'brock_id');
  const [row] =
    await sql`SELECT player_id FROM player_session WHERE token_hash = ${hashToken(cookie!.value)}`;
  return row.player_id;
}

/** Fixes the House's throw for the open round (and re-commits to it). */
export async function rigHouse(playerId: string, house: 'rock' | 'paper' | 'scissors') {
  const [round] = await sql`
    SELECT r.id, r.salt FROM brock_round r JOIN brock b ON b.id = r.brock_id
    WHERE b.player_id = ${playerId} AND b.day = ${utc()} AND r.player_throw IS NULL`;
  await sql`UPDATE brock_round SET house_throw = ${house}, commit_hash = ${commit(house, round.salt)} WHERE id = ${round.id}`;
}

/** The right option for quiz question `index` today. */
export async function quizAnswer(playerId: string, index: number): Promise<number> {
  const [row] = await sql`
    SELECT q.items FROM brock_quiz q JOIN brock b ON b.id = q.brock_id
    WHERE b.player_id = ${playerId} AND b.day = ${utc()}`;
  return row.items[index].answerIndex;
}

export const scoreCaption = (page: Page, score: number) =>
  page.getByLabel(new RegExp(`^Today’s run ${score}, best run \\d+$`));

/** Throws rock against a rigged House: `wins` wins (pressing BROCK after each), then a loss. */
export async function playRun(page: Page, playerId: string, wins: number) {
  for (let i = 0; i < wins; i++) {
    await rigHouse(playerId, 'scissors');
    await page.getByRole('button', { name: 'Rock' }).click();
    await expect(page.getByTestId('outcome')).toHaveText('YOU WIN!');
    await expect(scoreCaption(page, i + 1)).toBeVisible();
    await page.getByRole('button', { name: 'BROCK', exact: true }).click();
  }
  await rigHouse(playerId, 'paper');
  await page.getByRole('button', { name: 'Rock' }).click();
  await expect(page.getByTestId('outcome')).toHaveText('THE HOUSE WINS');
}
