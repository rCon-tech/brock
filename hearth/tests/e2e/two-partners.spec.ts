import { expect, test } from '@playwright/test';
import { finishToBoard, startCouple } from './helpers';

test('two people with different tastes reach a shared board together', async ({ browser }) => {
  const c = await startCouple(browser);
  await finishToBoard(c);

  for (const page of [c.rich, c.sam]) {
    // A named shared style, never an empty "0 matches".
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Your shared style')).toBeVisible();
    await expect(page.getByText(/0 matches|no matches/i)).toHaveCount(0);
    // Each person sees something of theirs, and there are no scores.
    await expect(page.getByRole('heading', { name: 'What you each bring' })).toBeVisible();
    await expect(page.getByText(/\d+\s?%/)).toHaveCount(0);
    // Compromise picks with buy links that go through /go (affiliate disclosure, click logging).
    await expect(page.getByRole('heading', { name: 'Works for both of you' })).toBeVisible();
    const buy = page.getByRole('link', { name: /^Buy/ }).first();
    await expect(buy).toHaveAttribute('href', /^\/go\//);
    await expect(buy).toHaveAttribute('rel', /sponsored/);
    await expect(page.getByText(/affiliate links/i).first()).toBeVisible();
  }
  // Both see the same board.
  const a = await c.rich.getByRole('heading', { level: 1 }).innerText();
  const b = await c.sam.getByRole('heading', { level: 1 }).innerText();
  expect(a).toBe(b);
  await c.richCtx.close();
  await c.samCtx.close();
});

test('the buy button logs the click and redirects to the retailer', async ({ browser }) => {
  const c = await startCouple(browser);
  await finishToBoard(c);
  const href = await c.rich.getByRole('link', { name: /^Buy/ }).first().getAttribute('href');
  const res = await c.rich.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toMatch(/^https:\/\/example\.com\/p\//);
  await c.richCtx.close();
  await c.samCtx.close();
});

test('someone without the link cannot see the room', async ({ browser }) => {
  const c = await startCouple(browser);
  const stranger = await browser.newContext({ baseURL: 'http://localhost:3100' });
  const page = await stranger.newPage();
  const res = await page.goto(c.projectPath);
  // A stranger has no session, so they are sent home rather than shown anything.
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await stranger.close();
  await c.richCtx.close();
  await c.samCtx.close();
});
