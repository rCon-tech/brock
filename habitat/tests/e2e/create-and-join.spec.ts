import { expect, test } from '@playwright/test';
import { newPerson, signUp } from './fixtures';


test('A creates a Habitat, invites B by link, and B joins', async ({ page, browser }) => {
  // A signs up and creates a Habitat
  await signUp(page, 'Alice');
  await page.waitForURL('**/');
  await page.getByRole('link', { name: /new habitat/i }).click();
  await page.getByLabel('Name').fill('The Lads');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Use 🍻' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Feed')).toBeVisible();
  await page.getByRole('button', { name: 'Create Habitat' }).click();
  await expect(page.getByRole('heading', { name: /invite your friends/i })).toBeVisible();
  const invite = await page.getByLabel('Invite link').inputValue();
  expect(invite).toMatch(/\/join\/[0-9A-Z]{10}$/);
  await page.getByRole('button', { name: /go to the lads/i }).click();
  await expect(page).toHaveURL(/\/h\/the-lads$/);

  // B opens the link signed out, signs up, and lands back on the join page
  const b = await newPerson(browser);
  await b.page.goto(invite);
  await expect(b.page.getByRole('heading', { name: /invited to the lads/i })).toBeVisible();
  await b.page.getByRole('link', { name: /sign in to join/i }).click();
  await signUp(b.page, 'Bob', new URL(invite).pathname);
  await b.page.getByRole('button', { name: /join the lads/i }).click();
  await expect(b.page).toHaveURL(/\/h\/the-lads$/);

  // Both are now listed as members
  await page.goto('/h/the-lads/members');
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();

  // A stranger gets a plain 404
  const c = await newPerson(browser);
  await signUp(c.page, 'Carol');
  const res = await c.page.goto('/h/the-lads');
  expect(res?.status()).toBe(404);
  await expect(c.page.getByText(/can’t find that/i)).toBeVisible();

  await b.context.close();
  await c.context.close();
});
