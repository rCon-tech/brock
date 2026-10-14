import { expect, test, type Browser, type Page } from '@playwright/test';

const unique = (label: string) =>
  `${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 20);

/** The handle link in the header. (A winner also appears in the leaderboard table, so scope to the nav.) */
const navHandle = (page: Page, handle: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: `@${handle}` });

/** Opens the game as a brand-new visitor: no login, no setup, just the picker. */
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Brock', exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Current streak \d+, best streak \d+$/)).toBeVisible();
}

/** Throws rock until the day's Brock is decided, returning how it ended. */
async function playUntilDecided(page: Page): Promise<'won' | 'lost'> {
  const picker = page.getByRole('group', { name: 'Choose your throw' });
  for (let i = 0; i < 25; i++) {
    await picker.getByRole('button', { name: 'Rock' }).click();
    const outcome = page.getByTestId('outcome');
    await expect(outcome).toBeVisible();
    const text = (await outcome.textContent()) ?? '';
    if (text === 'YOU WIN!') return 'won';
    if (text === 'THE HOUSE WINS') return 'lost';
    expect(text).toBe('TIE!');
    await page.getByRole('button', { name: 'BROCK', exact: true }).click();
  }
  throw new Error('25 draws in a row, which should be (1/3)^25 unlikely');
}

/** Names the player after a finished Brock. */
async function nameMe(page: Page, handle: string) {
  await page.getByLabel('Add your name to the leaderboard').fill(handle);
  await page.getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(navHandle(page, handle)).toBeVisible();
}

/** A named player who has finished today's Brock. */
async function namedPlayer(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page);
  const result = await playUntilDecided(page);
  const handle = unique(label);
  await nameMe(page, handle);
  return { context, page, handle, result };
}

test('a first-time visitor can play immediately with no login', async ({ page }) => {
  await open(page);
  await expect(page.getByText('No sign-up: just play.')).toBeVisible();
  await expect(page.getByText('The House has chosen.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Played before? Log in' })).toBeVisible();
  await expect(page.getByText(/password|recovery code/i)).toHaveCount(0);
});

test('play, name yourself afterwards, and the browser remembers you', async ({ page, context }) => {
  await open(page);
  const result = await playUntilDecided(page);

  // The arena shows the throw that was picked (playUntilDecided always throws rock).
  await expect(page.locator('.arena-side[data-side="player"] .pivot use')).toHaveAttribute(
    'href',
    '#hand-rock',
  );

  // Result first; only then are we asked for a name.
  await expect(page.getByLabel('Add your name to the leaderboard')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share result' })).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();

  const handle = unique('rich');
  await nameMe(page, handle);

  // Named: prompt gone, header shows the handle, and the streak is still there.
  await expect(page.getByLabel('Add your name to the leaderboard')).toHaveCount(0);
  await expect(navHandle(page, handle)).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      result === 'won'
        ? 'Come back tomorrow to keep your streak going.'
        : 'Come back tomorrow to start a new streak.',
    ),
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
    await expect(row.getByRole('cell').nth(2)).toHaveText('1');
  } else {
    await expect(row).toHaveCount(0);
  }
  await page.goto(`/u/${handle}`);
  await expect(page.getByRole('heading', { name: `@${handle}` })).toBeVisible();
  await expect(page.getByRole('list', { name: /Last 30 days/ }).getByRole('listitem')).toHaveCount(
    30,
  );
});

test('on a new device you just type your username, and the old device stays logged in', async ({
  browser,
}) => {
  const original = await namedPlayer(browser, 'back');

  // New phone: no cookies. The home page points returning players at the login.
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await open(page);
  await page.getByRole('link', { name: 'Played before? Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Your username').fill(original.handle.toUpperCase());
  await page.getByRole('button', { name: 'LOG IN', exact: true }).click();

  // Same player: same handle, and today's Brock is already played.
  await expect(page).toHaveURL(/\/$/);
  await expect(navHandle(page, original.handle)).toBeVisible();
  await expect(page.getByText(/Next Brock in/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose your throw' })).toHaveCount(0);

  // The first device is still logged in.
  await original.page.reload();
  await expect(navHandle(original.page, original.handle)).toBeVisible();
  await expect(original.page.getByText(/Next Brock in/)).toBeVisible();

  await Promise.all([original.context.close(), fresh.close()]);
});

test('logging in with a name nobody has explains what to do', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Your username').fill(unique('ghost'));
  await page.getByRole('button', { name: 'LOG IN', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'No player with that name' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('a handle can only be taken once, case-insensitively', async ({ browser }) => {
  const first = await namedPlayer(browser, 'dup');

  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page);
  await playUntilDecided(page);
  await page.getByLabel('Add your name to the leaderboard').fill(first.handle.toUpperCase());
  await page.getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Handle taken' })).toBeVisible();

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
  const formPost = await api.post('/api/player/login', { form: { handle: 'x' } });
  expect(formPost.status()).toBe(400);

  // Bad input is rejected.
  expect(
    (await api.post('/api/brock/throw', { data: { roundNo: 1, throw: 'lizard' } })).status(),
  ).toBe(400);
  expect((await api.post('/api/player/login', { data: {} })).status()).toBe(400);

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
