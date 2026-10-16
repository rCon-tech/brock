import { expect, type Page } from '@playwright/test';
import { signUp } from './fixtures';

/** Drive the create wizard; returns the invite link and the Habitat's slug. */
export async function createHabitatViaUi(page: Page, name: string) {
  await page.goto('/new');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Create Habitat' }).click();
  await expect(page.getByRole('heading', { name: /invite your friends/i })).toBeVisible();
  const invite = await page.getByLabel('Invite link').inputValue();
  await page.getByRole('button', { name: /^go to/i }).click();
  await page.waitForURL(/\/h\/[^/]+$/);
  return { invite, slug: new URL(page.url()).pathname.split('/')[2]! };
}

export async function joinViaInvite(page: Page, name: string, invite: string) {
  const path = new URL(invite).pathname;
  await signUp(page, name, path);
  await page.getByRole('button', { name: /^join /i }).click();
  await page.waitForURL(/\/h\/[^/]+$/);
}
