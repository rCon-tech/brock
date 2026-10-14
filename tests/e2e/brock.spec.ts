import { expect, test, type BrowserContext, type Page } from '@playwright/test';

let counter = 0;

/** Creates a user through the test-only email/password endpoint; the session cookie lands in the context. */
async function signUp(context: BrowserContext, label: string) {
  const unique = `${label}${Date.now().toString(36)}${counter++}`;
  const res = await context.request.post('/api/auth/sign-up/email', {
    headers: { origin: new URL(context.pages()[0]?.url() || 'http://localhost:3100').origin },
    data: { email: `${unique}@example.com`, password: 'password1234', name: unique },
  });
  expect(res.status(), await res.text()).toBe(200);
  return unique;
}

async function onboard(page: Page, handle: string) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Your handle').fill(handle);
  await page.getByRole('button', { name: 'Start Brocking' }).click();
}

/** Throws rock until the day's Brock is decided, returning how it ended. */
async function playUntilDecided(page: Page): Promise<'won' | 'lost'> {
  const picker = page.getByRole('group', { name: 'Choose your throw' });
  for (let i = 0; i < 25; i++) {
    await picker.getByRole('button', { name: 'Rock' }).click();
    const outcome = page.locator('p.text-2xl');
    await expect(outcome).toBeVisible();
    const text = (await outcome.textContent()) ?? '';
    if (text.includes('You win')) return 'won';
    if (text.includes('You lose')) return 'lost';
    await page.getByRole('button', { name: 'Throw again' }).click();
  }
  throw new Error('25 draws in a row, which should be (1/3)^25 unlikely');
}

test('signed-out visitors see the landing page and leaderboard teaser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One Brock a day');
  await expect(page.getByRole('heading', { name: 'Longest streaks' })).toBeVisible();
});

test('game API rejects signed-out requests', async ({ request }) => {
  const res = await request.get('/api/brock/today');
  expect(res.status()).toBe(401);
});

test('sign up, pick a handle, play a full Brock, and see the result everywhere', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const handle = (await signUp(context, 'rich')).slice(0, 20);
  await onboard(page, handle);

  // Home is now the game.
  await expect(page.getByRole('heading', { name: /^Brock #\d+$/ })).toBeVisible();
  await expect(page.getByText('The House has chosen.')).toBeVisible();
  await expect(page.getByRole('link', { name: `@${handle}` })).toBeVisible();

  const result = await playUntilDecided(page);

  // Final state: reveal, streak summary, share + countdown.
  if (result === 'won') {
    await expect(page.getByText('Brocked! Streak: 🔥 1')).toBeVisible();
  } else {
    await expect(page.getByText('Streak over. Back to 0.')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Share result' })).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();

  // The browser recomputes the House's commitment.
  await page.getByRole('button', { name: 'Verify fairness' }).click();
  await expect(page.getByText(/matches the hash shown before you threw/)).toBeVisible();

  // Coming back later shows the result, never the picker (one Brock a day).
  await page.reload();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);

  // The API agrees.
  const today = await (await context.request.get('/api/brock/today')).json();
  expect(today.status).toBe(result);
  expect(today.openRound).toBeNull();
  const again = await context.request.post('/api/brock/throw', {
    data: { roundNo: 1, throw: 'rock' },
  });
  expect(again.status()).toBe(409);

  // Leaderboard: winners are listed (and highlighted); losers aren't on it.
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: `@${handle}` });
  if (result === 'won') {
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('🔥 1');
  } else {
    await expect(row).toHaveCount(0);
  }

  // Profile page.
  await page.goto(`/u/${handle}`);
  await expect(page.getByRole('heading', { name: `@${handle}` })).toBeVisible();
  await expect(page.getByRole('list', { name: /Last 30 days/ }).getByRole('listitem')).toHaveCount(
    30,
  );
});

test('a handle can only be claimed once, case-insensitively', async ({ browser }) => {
  const handle = `dup${Date.now().toString(36)}`.slice(0, 20);

  const first = await browser.newContext();
  const firstPage = await first.newPage();
  await firstPage.goto('/');
  await signUp(first, 'first');
  await onboard(firstPage, handle);
  await expect(firstPage.getByRole('heading', { name: /^Brock #\d+$/ })).toBeVisible();

  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await secondPage.goto('/');
  await signUp(second, 'second');
  await onboard(secondPage, handle.toUpperCase());
  await expect(secondPage.getByRole('alert').filter({ hasText: 'Handle taken' })).toBeVisible();
  await expect(secondPage).toHaveURL(/\/onboarding$/);

  await first.close();
  await second.close();
});
