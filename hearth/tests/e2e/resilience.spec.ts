import { expect, test } from '@playwright/test';
import { swipeDeck, topTitle } from './helpers';

const BASE = 'http://localhost:3100';

async function startQuiz(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/quiz');
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.waitForURL(/\/swipe/);
  return { ctx, page };
}

test('swiping offline still works and every swipe is saved once when the connection returns (R32)', async ({
  browser,
}) => {
  const { ctx, page } = await startQuiz(browser);
  await swipeDeck(page, () => true, { max: 4 });
  await ctx.setOffline(true);
  await swipeDeck(page, () => false, { max: 4 });
  await expect(page.getByText('Saved, will sync')).toBeVisible();
  await ctx.setOffline(false);
  await expect(page.getByText('Saved, will sync')).toBeHidden({ timeout: 20_000 });

  // Reloading shows the server has all 8 answers: the deck resumes at card 9.
  await page.reload();
  await expect(page.getByText(/9 of 12/)).toBeVisible();
  await ctx.close();
});

test('closing the tab mid-deck loses nothing', async ({ browser }) => {
  const { ctx, page } = await startQuiz(browser);
  await swipeDeck(page, () => true, { max: 5 });
  await page.waitForTimeout(800); // let the queue flush
  const url = page.url();
  await page.close();
  const again = await ctx.newPage();
  await again.goto(url);
  await expect(again.getByText(/6 of 12/)).toBeVisible();
  await ctx.close();
});

test('a card whose image fails is replaced from the reserves (R33)', async ({ browser }) => {
  const { ctx, page } = await startQuiz(browser);
  const first = await expect
    .poll(() => topTitle(page))
    .not.toBeNull()
    .then(() => topTitle(page));
  // Break exactly that card's image, then reload so it has to load.
  await page.route(/\/api\/placeholder/, (route) => {
    const t = new URL(route.request().url()).searchParams.get('t');
    return t === first ? route.fulfill({ status: 404, body: 'gone' }) : route.continue();
  });
  await page.reload();
  await expect.poll(() => topTitle(page), { timeout: 15_000 }).not.toBe(first);
  // The deck is still the right length.
  await expect(page.getByText(/1 of 12/)).toBeVisible();
  await ctx.close();
});

test('kept furniture never turns up in the deck (R14)', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/quiz');
  await page.getByRole('button', { name: 'Sofa', exact: true }).click();
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.waitForURL(/\/swipe/);
  const titles: string[] = [];
  await swipeDeck(page, () => true, { onCard: async (t) => void titles.push(t) });
  expect(titles).toHaveLength(30);
  expect(titles.filter((t) => /sofa/i.test(t))).toEqual([]);
  await ctx.close();
});
