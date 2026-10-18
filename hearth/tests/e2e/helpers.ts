import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const INDUSTRIAL =
  /Foundry|Loft|Forge|Slab|Monolith|Bunker|Axis|Prism|Vertex|Industrial|Brutalist|Contemporary/i;
export const MINIMAL =
  /Plain|Nord|Lumen|Kinto|Shoji|Haru|Fjord|Hygge|Birk|Minimalist|Japandi|Scandinavian/i;

/** The title of the card on top of the deck, from its accessible label. */
export async function topTitle(page: Page): Promise<string | null> {
  const card = page.locator('[aria-label*="Swipe right for yes"]').first();
  if (!(await card.isVisible().catch(() => false))) return null;
  const label = (await card.getAttribute('aria-label')) ?? '';
  return label.split('. Swipe')[0];
}

/**
 * Swipes through whatever the deck shows, with the buttons, until the page moves on (to the
 * personal result, the handoff, the reveal or the board). Handles the first-run hint and the
 * halfway interlude.
 */
export async function swipeDeck(
  page: Page,
  likes: (title: string) => boolean,
  opts: { max?: number; onCard?: (title: string, index: number) => Promise<void> } = {},
): Promise<number> {
  let swiped = 0;
  const max = opts.max ?? 80;
  for (let guard = 0; guard < 200 && swiped < max; guard++) {
    const gotIt = page.getByRole('button', { name: 'Got it' });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
    const next = page.getByRole('button', { name: 'Show me the pieces' });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(400);
      continue;
    }
    const title = await topTitle(page);
    if (!title) {
      if (/\/(me|handoff|board|reveal)/.test(page.url())) break;
      await page.waitForTimeout(250);
      continue;
    }
    if (opts.onCard) await opts.onCard(title, swiped);
    await page.getByRole('button', { name: likes(title) ? 'Yes' : 'No', exact: true }).click();
    swiped++;
    // The card flies off in ~0.2s; wait for the next one to take its place.
    await page.waitForTimeout(260);
  }
  return swiped;
}

export interface Couple {
  rich: Page;
  sam: Page;
  richCtx: BrowserContext;
  samCtx: BrowserContext;
  projectPath: string;
}

/** Rich creates a living-room project; Sam joins from the invite link in a separate browser. */
export async function startCouple(browser: Browser, opts: { dog?: boolean } = {}): Promise<Couple> {
  const richCtx = await browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3100',
  });
  const samCtx = await browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3100',
  });
  const rich = await richCtx.newPage();
  const sam = await samCtx.newPage();

  await rich.goto('/start');
  await rich.getByRole('button', { name: 'Living room' }).click();
  if (opts.dog) await rich.getByRole('button', { name: 'A dog' }).click();
  await rich.getByLabel('Your first name').fill('Rich');
  await rich.getByRole('button', { name: 'Create the room' }).click();
  await rich.waitForURL(/\/r\/[a-z0-9]+$/);
  const projectPath = new URL(rich.url()).pathname;

  const link = await rich.getByRole('textbox', { name: 'Invite link' }).inputValue();
  await sam.goto(new URL(link).pathname);
  await sam.getByLabel('Your first name').fill('Sam');
  await sam.getByRole('button', { name: 'Start swiping' }).click();
  await sam.waitForURL(/\/swipe/);
  return { rich, sam, richCtx, samCtx, projectPath };
}

/** Both swipe their whole decks, tap ready, and wait for the shared board. */
export async function finishToBoard(c: Couple): Promise<void> {
  await swipeDeck(c.sam, (t) => MINIMAL.test(t));
  await c.rich.goto(`${c.projectPath}/swipe`);
  await swipeDeck(c.rich, (t) => INDUSTRIAL.test(t));
  await c.rich.getByRole('button', { name: /ready to see the board/i }).click();
  await c.rich.waitForURL(/\/reveal/);
  await c.sam.getByRole('button', { name: /ready to see the board/i }).click();
  await expect(c.rich).toHaveURL(/\/board/, { timeout: 30_000 });
  await expect(c.sam).toHaveURL(/\/board/, { timeout: 30_000 });
}
