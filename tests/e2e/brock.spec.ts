import { expect, test, type Browser, type Page } from '@playwright/test';

const unique = (label: string) =>
  `${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 20);

/** The handle link in the header. (A winner also appears in the leaderboard table, so scope to the nav.) */
const navHandle = (page: Page, handle: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: `@${handle}` });

/** Opens the game as a brand-new visitor: no login, no setup, just the picker. */
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Brock #\d+$/ })).toBeVisible();
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

/** Names the player and acknowledges the recovery code. Returns the code. */
async function nameAndSave(page: Page, handle: string): Promise<string> {
  await page.getByLabel('Add your name to the leaderboard').fill(handle);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const code = (await page.getByTestId('recovery-code').textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  const proceed = page.getByRole('button', { name: 'Continue' });
  await expect(proceed).toBeDisabled();
  await page.getByLabel('I’ve saved my recovery code').check();
  await proceed.click();
  return code;
}

/** A named player who has finished today's Brock. */
async function namedPlayer(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page);
  const result = await playUntilDecided(page);
  const handle = unique(label);
  const code = await nameAndSave(page, handle);
  await expect(navHandle(page, handle)).toBeVisible();
  return { context, page, handle, code, result };
}

test('a first-time visitor can play immediately with no login', async ({ page }) => {
  await open(page);
  await expect(page.getByText('No sign-up: just play.')).toBeVisible();
  await expect(page.getByText('The House has chosen.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Restore' })).toBeVisible();
  await expect(page.getByText(/sign in|log in/i)).toHaveCount(0);
});

test('play, name yourself afterwards, and the browser remembers you', async ({ page, context }) => {
  await open(page);
  const result = await playUntilDecided(page);

  // Result first; only then are we asked for a name.
  await expect(page.getByLabel('Add your name to the leaderboard')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share result' })).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();

  const handle = unique('rich');
  await nameAndSave(page, handle);

  // Named: prompt gone, header shows the handle, and the streak is still there.
  await expect(page.getByLabel('Add your name to the leaderboard')).toHaveCount(0);
  await expect(navHandle(page, handle)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Restore' })).toHaveCount(0);
  await expect(
    page.getByText(result === 'won' ? 'Brocked! Streak: 🔥 1' : 'Streak over. Back to 0.'),
  ).toBeVisible();

  // Remembered after a reload and in a new tab, with no login.
  await page.reload();
  await expect(navHandle(page, handle)).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);
  const second = await context.newPage();
  await open(second);
  await expect(navHandle(second, handle)).toBeVisible();

  // The identity cookie is httpOnly (scripts can't read it) and lasts about a year.
  const cookie = (await context.cookies()).find((c) => c.name === 'brock_id')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 3600);
  expect(await page.evaluate(() => document.cookie)).not.toContain('brock_id');

  // The profile and leaderboard agree.
  await page.goto('/leaderboard');
  const row = page.getByRole('row').filter({ hasText: `@${handle}` });
  if (result === 'won') {
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('🔥 1');
  } else {
    await expect(row).toHaveCount(0);
  }
  await page.goto(`/u/${handle}`);
  await expect(page.getByRole('heading', { name: `@${handle}` })).toBeVisible();
  await expect(page.getByRole('list', { name: /Last 30 days/ }).getByRole('listitem')).toHaveCount(
    30,
  );
});

test('a lost device can be restored with the recovery code, and the old one is signed out', async ({
  browser,
}) => {
  const original = await namedPlayer(browser, 'back');

  // New phone: no cookies, so they start as a fresh anonymous player.
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto('/recover');

  await page.getByLabel('Handle').fill(original.handle);
  await page.getByLabel('Recovery code').fill(original.code.toLowerCase().replaceAll('-', ' '));
  await page.getByRole('button', { name: 'Restore my streak' }).click();

  // They're handed a *new* code, since each code works once.
  await expect(
    page.getByRole('heading', { name: `Welcome back, @${original.handle}` }),
  ).toBeVisible();
  const newCode = (await page.getByTestId('recovery-code').textContent()) ?? '';
  expect(newCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  expect(newCode).not.toBe(original.code);
  await page.getByLabel('I’ve saved my recovery code').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Same player: already Brocked today, same handle.
  await expect(page).toHaveURL(/\/$/);
  await expect(navHandle(page, original.handle)).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);

  // The old code is spent.
  const retry = await browser.newContext();
  const retryRes = await retry.request.post('/api/player/recover', {
    data: { handle: original.handle, code: original.code },
  });
  expect(retryRes.status()).toBe(403);

  // The old device lost its identity: it's a brand-new player with a fresh picker.
  await original.page.reload();
  await expect(original.page.getByRole('link', { name: 'Restore' })).toBeVisible();
  await expect(original.page.getByRole('group', { name: 'Choose your throw' })).toBeVisible();

  await Promise.all([original.context.close(), fresh.close(), retry.close()]);
});

test('restoring with the wrong code is refused without revealing why', async ({
  browser,
  page,
}) => {
  const player = await namedPlayer(browser, 'wrong');

  await page.goto('/recover');
  await page.getByLabel('Handle').fill(player.handle);
  await page.getByLabel('Recovery code').fill('AAAA-BBBB-CCCC-DDDD');
  await page.getByRole('button', { name: 'Restore my streak' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'don’t match' })).toBeVisible();

  await page.getByLabel('Handle').fill(unique('ghost'));
  await page.getByRole('button', { name: 'Restore my streak' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'don’t match' })).toBeVisible();

  await player.context.close();
});

test('a handle can only be taken once, case-insensitively', async ({ browser }) => {
  const first = await namedPlayer(browser, 'dup');

  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page);
  await playUntilDecided(page);
  await page.getByLabel('Add your name to the leaderboard').fill(first.handle.toUpperCase());
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Handle taken' })).toBeVisible();
  await expect(page.getByTestId('recovery-code')).toHaveCount(0);

  await Promise.all([first.context.close(), context.close()]);
});

test('the API enforces the rules the UI relies on', async ({ browser }) => {
  const context = await browser.newContext();
  const api = context.request;

  // No identity yet: can't throw or name.
  expect(
    (await api.post('/api/brock/throw', { data: { roundNo: 1, throw: 'rock' } })).status(),
  ).toBe(401);
  expect((await api.post('/api/player/handle', { data: { handle: 'early_bird' } })).status()).toBe(
    401,
  );

  // Opening today's Brock creates the identity, but you still can't name yourself before playing.
  const today = await api.get('/api/brock/today');
  expect(today.status()).toBe(200);
  expect((await today.json()).handle).toBeNull();
  const early = await api.post('/api/player/handle', { data: { handle: 'early_bird' } });
  expect(early.status()).toBe(403);
  expect((await early.json()).error).toBe('play_first');

  // The open round only exposes a hash.
  const open = (await (await api.get('/api/brock/today')).json()).openRound;
  expect(Object.keys(open).sort()).toEqual(['commitHash', 'roundNo']);

  // A cross-site HTML form can't change state: only JSON bodies are accepted.
  const formPost = await api.post('/api/player/recover', { form: { handle: 'x', code: 'y' } });
  expect(formPost.status()).toBe(400);

  // Bad input is rejected.
  expect(
    (await api.post('/api/brock/throw', { data: { roundNo: 1, throw: 'lizard' } })).status(),
  ).toBe(400);
  expect((await api.post('/api/player/recover', { data: {} })).status()).toBe(400);

  await context.close();
});

test('the leaderboard is public and needs no identity', async ({ request }) => {
  const res = await request.get('/api/leaderboard?limit=5');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.entries)).toBe(true);
  expect(body.me).toBeUndefined();
  expect(res.headers()['cache-control']).toContain('s-maxage');
});
