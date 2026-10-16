import { expect, test } from '@playwright/test';
import { newPerson, signUp } from './fixtures';
import { createHabitatViaUi, joinViaInvite } from './helpers';

test('A proposes Polls, B votes yes, and Polls appears for both', async ({ page, browser }) => {
  await signUp(page, 'Fay');
  const { invite, slug } = await createHabitatViaUi(page, 'Vote Test');
  const b = await newPerson(browser);
  await joinViaInvite(b.page, 'Gus', invite);

  // Polls isn't there yet
  await page.goto(`/h/${slug}/library`);
  await expect(page.getByRole('link', { name: /Polls/ }).first()).toBeVisible();
  await page.goto(`/h/${slug}`);
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: 'Polls', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Fay proposes it
  await page.goto(`/h/${slug}/library/polls`);
  await page.getByRole('button', { name: /propose adding polls/i }).click();
  await page.getByLabel(/why should we add it/i).fill('To settle where we eat');
  await page.getByRole('button', { name: 'Start vote' }).click();
  await expect(page.getByText('Vote started')).toBeVisible();

  // Gus sees an open vote and says yes
  await b.page.goto(`/h/${slug}/proposals`);
  await expect(b.page.getByText('Add Polls')).toBeVisible();
  await expect(b.page.getByText('“To settle where we eat”')).toBeVisible();
  await b.page.getByRole('button', { name: 'Yes' }).click();
  await expect(b.page.getByText('It passed!')).toBeVisible();

  // Polls is now in the nav for Gus right away, and for Fay once her page re-reads it.
  // On a phone the fifth item lives under "More".
  await b.page.getByRole('button', { name: 'More' }).click();
  await expect(b.page.getByRole('link', { name: 'Polls' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: 'Polls' })).toBeVisible();

  // And it works: Fay asks a question, Gus answers
  await page.goto(`/h/${slug}/m/polls`);
  await page.getByRole('button', { name: /new poll/i }).click();
  await page.getByLabel('Question').fill('Pizza or curry?');
  await page.getByLabel('Option 1').fill('Pizza');
  await page.getByLabel('Option 2').fill('Curry');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByRole('heading', { name: 'Pizza or curry?' })).toBeVisible();

  await b.page.goto(`/h/${slug}/m/polls`);
  await b.page.getByLabel('Curry').click();
  await b.page.getByRole('button', { name: 'Vote', exact: true }).click();
  await expect(b.page.getByText('100%')).toBeVisible();
  await b.context.close();
});
