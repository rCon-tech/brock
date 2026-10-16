import { expect, test } from '@playwright/test';
import { newPerson, signUp } from './fixtures';
import { createHabitatViaUi, joinViaInvite } from './helpers';

test('post, react, comment and @mention', async ({ page, browser }) => {
  await signUp(page, 'Dana');
  const { invite, slug } = await createHabitatViaUi(page, 'Feed Test');
  const b = await newPerson(browser);
  await joinViaInvite(b.page, 'Erin', invite);
  await b.page.goto(`/h/${slug}`);

  // Dana posts and mentions Erin
  await page.goto(`/h/${slug}`);
  await page.getByLabel('Write a post').fill('Hello team, welcome @Erin');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('Hello team, welcome')).toBeVisible();

  // Erin sees it, is notified, reacts and comments
  await b.page.reload();
  await expect(b.page.getByText('Hello team, welcome')).toBeVisible();
  await b.page.getByRole('button', { name: /Notifications/ }).click();
  await expect(b.page.getByText(/Dana mentioned you in a post/)).toBeVisible();
  await b.page.keyboard.press('Escape');
  await b.page.getByRole('button', { name: /^❤️/ }).first().click();
  await expect(b.page.getByRole('button', { name: '❤️ 1' })).toBeVisible();
  await b.page.getByRole('button', { name: /^Comment$/ }).click();
  await b.page.getByLabel('Write a comment…').fill('Thanks Dana!');
  // Wait for the server to confirm: the text sitting in the textarea would satisfy getByText too early.
  const saved = b.page.waitForResponse(
    (r) => r.url().includes('/comments') && r.request().method() === 'POST',
  );
  await b.page.getByRole('button', { name: 'Send' }).click();
  expect((await saved).status()).toBe(201);
  await expect(b.page.getByLabel('Write a comment…')).toHaveValue('');
  await expect(b.page.getByText('Thanks Dana!')).toBeVisible();

  // Dana is told about the comment
  await page.reload();
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByText(/Erin commented on your post/)).toBeVisible();
  await b.context.close();
});
