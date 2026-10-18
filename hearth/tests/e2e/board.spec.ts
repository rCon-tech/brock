import { expect, test, type Page } from '@playwright/test';
import { finishToBoard, startCouple, swipeDeck, type Couple } from './helpers';

test.describe.configure({ mode: 'serial' });

let c: Couple;
test.beforeAll(async ({ browser }) => {
  c = await startCouple(browser);
  await finishToBoard(c);
});
test.afterAll(async () => {
  await c.richCtx.close();
  await c.samCtx.close();
});

const cardTitles = (page: Page) => page.locator('article h3').allInnerTexts();

test('"not quite, show me another" swaps a pick in the same category, and undo restores it (R28)', async () => {
  const before = await cardTitles(c.rich);
  const first = c.rich.locator('article').first();
  const oldTitle = await first.locator('h3').innerText();
  await first.getByRole('button', { name: 'Not quite, show me another' }).click();
  await expect(c.rich.getByRole('button', { name: 'Undo' }).first()).toBeVisible();
  await expect.poll(async () => (await cardTitles(c.rich)).includes(oldTitle)).toBe(false);
  expect((await cardTitles(c.rich)).length).toBeLessThanOrEqual(before.length);

  await c.rich.getByRole('button', { name: 'Undo' }).first().click();
  await expect.poll(async () => (await cardTitles(c.rich)).includes(oldTitle)).toBe(true);
});

test('reactions: both loving an item puts it on the shopping list; a note shows to the other person (R29)', async () => {
  await c.rich.reload();
  await c.sam.reload();
  const title = await c.rich.locator('article').first().locator('h3').innerText();
  const articleFor = (p: Page) =>
    p.locator('article', { has: p.getByRole('heading', { name: title }) }).first();

  await articleFor(c.rich).getByRole('button', { name: 'Add note' }).click();
  await articleFor(c.rich).getByLabel('Note').fill('love this but in green?');
  await articleFor(c.rich).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(articleFor(c.rich).getByText('love this but in green?')).toBeVisible();
  await articleFor(c.rich).getByRole('button', { name: 'Love it' }).click();
  await articleFor(c.sam).getByRole('button', { name: 'Love it' }).click();

  await c.sam.reload();
  await expect(articleFor(c.sam).getByText('Rich')).toBeVisible();
  await expect(articleFor(c.sam).getByText(/love this but in green\?/)).toBeVisible();
  const list = c.sam.getByRole('region', { name: 'Your shopping list' });
  await expect(list.getByText(title)).toBeVisible();
  await expect(list.getByText(/You all loved it/)).toBeVisible();
  await expect(list.getByLabel('Total')).toContainText('£');
});

test('✕ moves an item into "Not for us"', async () => {
  await c.rich.reload();
  const first = c.rich.locator('article').nth(1);
  const title = await first.locator('h3').innerText();
  await first.getByRole('button', { name: 'Not for us' }).click();
  await c.rich.reload();
  await expect(c.rich.getByText(/Not for us \(\d+\)/)).toBeVisible();
  await expect(c.rich.getByRole('heading', { name: title })).toHaveCount(0);
});

test('the tie-breaker turns mutual yeses into agreed items', async () => {
  await c.rich.getByRole('button', { name: 'Start the tie-breaker' }).click();
  await c.rich.waitForURL(/\/tiebreak/);
  await swipeDeck(c.rich, () => true);
  await expect(c.rich).toHaveURL(/\/board/);
  await expect(c.rich.getByText(/waiting for the others/i)).toBeVisible();

  await c.sam.reload();
  await c.sam.getByRole('link', { name: /Continue \(8 left\)/ }).click();
  await swipeDeck(c.sam, () => true);
  await expect(c.sam).toHaveURL(/\/board/);

  await c.rich.reload();
  await expect(c.rich.getByRole('heading', { name: 'You both said yes' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(c.rich.getByText(/Agreed in the tie-breaker/).first()).toBeVisible();
});

test('the style brief lists the palette and pieces, and saves as an image (R30)', async () => {
  await c.rich.getByRole('link', { name: 'Open the style brief' }).click();
  await expect(c.rich.getByText('Palette')).toBeVisible();
  await expect(c.rich.getByText(/#[0-9a-f]{6}/i).first()).toBeVisible();
  await expect(c.rich.getByRole('heading', { name: 'Pieces to look at' })).toBeVisible();
  await expect(c.rich.getByRole('img', { name: /QR code/ })).toBeVisible();
  const png = await c.rich.request.get(c.rich.url().replace('/brief', '/brief/image'));
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toContain('image/png');
});

test('feedback and the see-it-in-your-room fake door (§5)', async () => {
  await c.sam.goto(c.projectPath + '/board');
  await c.sam.getByRole('button', { name: /👍 Yes/ }).click();
  await expect(c.sam.getByText('Thanks, that really helps.')).toBeVisible();

  await c.sam.getByRole('button', { name: 'I’d like that' }).click();
  await expect(c.sam.getByText(/isn’t available yet/)).toBeVisible();
  await c.sam.getByLabel('Your email').fill('sam@example.com');
  await c.sam.getByRole('button', { name: 'Tell me when it’s ready' }).click();
  await expect(c.sam.getByText(/Nothing has been charged/)).toBeVisible();
});

test('"do another room" starts a fresh room with the same people', async () => {
  await c.rich.goto(c.projectPath + '/board');
  await c.rich
    .getByRole('button', { name: /Bedroom next|Dining room next/ })
    .first()
    .click();
  await c.rich.waitForURL(/\/swipe/);
  await expect(c.rich.getByRole('heading', { name: 'The rooms' })).toBeVisible();
});

test('settings: export my data', async () => {
  await c.rich.goto('/settings');
  const res = await c.rich.request.get('/api/me/export');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.participants.length).toBeGreaterThan(0);
  expect(data.swipes.length).toBeGreaterThan(30);
});
