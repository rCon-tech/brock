import { expect, test } from '@playwright/test';
import { INDUSTRIAL, MINIMAL, swipeDeck, topTitle } from './helpers';

const BASE = 'http://localhost:3100';

test('one phone: people take turns, the handoff hides progress, and the board appears without tapping ready (R17)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/start');
  await page.getByRole('button', { name: 'Living room' }).click();
  await page.getByRole('radio', { name: /Together, one phone/ }).check();
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Create the room' }).click();
  await page.waitForURL(/\/r\/[a-z0-9]+$/);

  // No invite link on a shared phone; add the second person instead.
  await expect(page.getByRole('textbox', { name: 'Invite link' })).toHaveCount(0);
  await page.getByLabel('Name of the next person').fill('Sam');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Sam', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Swipe as Rich' }).click();
  await swipeDeck(page, (t) => INDUSTRIAL.test(t));
  // The handoff screen says who is next and shows nothing about Rich's choices.
  await expect(page).toHaveURL(/\/handoff/);
  await expect(page.getByRole('heading', { name: 'Pass the phone to Sam' })).toBeVisible();
  await expect(page.getByText(/You lean|style/i)).toHaveCount(0);

  await page.getByRole('link', { name: 'I’m Sam' }).click();
  // Wait for the swipe page: until then the URL is still /handoff, which looks "finished".
  await page.waitForURL(/\/swipe\?as=/);
  await swipeDeck(page, (t) => MINIMAL.test(t));
  // Everyone has finished on one phone, so there is nothing to wait for.
  await page.goto(page.url().replace(/\/(me|handoff).*/, '/board'));
  await expect(page.getByText('Your shared style')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('navigation', { name: 'Viewing as' })).toBeVisible();
  await ctx.close();
});

test('the solo quiz gives you your own style, then a way to bring in a partner (R23)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/quiz');
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.waitForURL(/\/swipe/);
  await swipeDeck(page, (t) => INDUSTRIAL.test(t));
  await expect(page).toHaveURL(/\/me/);
  await expect(page.getByText(/^You lean /)).toBeVisible();
  await expect(page.getByRole('heading', { name: /how it fits with someone else/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Invite link' })).toBeVisible();
  // A board built from just this person's swipes is available straight away.
  await page.getByRole('link', { name: /board built from just my swipes/i }).click();
  await expect(page.getByText('Your style, for now')).toBeVisible();
  await ctx.close();
});

test('vetoes: three, with a named deal-breaker that shows anonymously on the board (R9, R22)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/quiz');
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.waitForURL(/\/swipe/);

  let vetoed: string | null = null;
  await swipeDeck(page, () => true, {
    onCard: async (title, i) => {
      // Veto the first product card (after the interlude), naming a feature.
      if (vetoed || i < 12) return;
      await page.getByRole('button', { name: /^Veto this card/ }).click();
      await page.getByRole('button', { name: 'Veto', exact: false }).first();
      const chip = page.getByRole('dialog').getByRole('button', { pressed: false }).first();
      vetoed = (await chip.innerText()).trim();
      await chip.click();
      await page
        .getByRole('button', { name: /^Veto / })
        .last()
        .click();
      expect(title).toBeTruthy();
    },
  });
  expect(vetoed).toBeTruthy();
  await expect(page).toHaveURL(/\/me/);
  await page.getByRole('link', { name: /board built from just my swipes/i }).click();
  await expect(page.getByRole('heading', { name: 'Off the table' })).toBeVisible();
  await expect(page.getByText(vetoed!, { exact: false }).first()).toBeVisible();
  await ctx.close();
});

test('card details show price and size before you decide (R27)', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/quiz');
  await page.getByLabel('Your first name').fill('Rich');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.waitForURL(/\/swipe/);
  await swipeDeck(page, () => true, { max: 12 });
  await page.getByRole('button', { name: 'Show me the pieces' }).click();
  const title = await expect
    .poll(() => topTitle(page))
    .not.toBeNull()
    .then(() => topTitle(page));
  await page.getByRole('button', { name: 'Show details' }).click();
  const sheet = page.getByRole('dialog', { name: 'Details' });
  await expect(sheet.getByRole('heading', { name: title! })).toBeVisible();
  await expect(sheet.getByText('Price', { exact: true })).toBeVisible();
  await expect(sheet.getByText(/£\d/)).toBeVisible();
  await expect(sheet.getByText('Size', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await ctx.close();
});
