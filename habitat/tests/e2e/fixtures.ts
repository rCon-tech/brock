import { expect, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { e2eEnv } from '../../playwright.config';

const sql = postgres(e2eEnv.DATABASE_URL, { max: 2 });

/** The newest magic link emailed to `email`, read from the test outbox. */
async function magicLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const rows = await sql<
      { html: string }[]
    >`select html from email_outbox where "to" = ${email} and subject like '%sign-in%' order by created_at desc limit 1`;
    const href = rows[0]?.html.match(/href="([^"]*magic-link[^"]*)"/)?.[1];
    if (href) return href.replace(/&amp;/g, '&');
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No magic link arrived for ${email}`);
}

/** Sign in as a brand-new person: request a link, follow it, and fill in the welcome step. */
export async function signUp(page: Page, name: string, next = '/') {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${Date.now()}@example.com`;
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /email me a sign-in link/i }).click();
  await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible();
  await page.goto(await magicLink(email));
  await expect(page.getByLabel(/what should your friends call you/i)).toBeVisible();
  await page.getByLabel(/what should your friends call you/i).fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  return email;
}

/** A second person in their own browser, so two people really are using the app at once. */
export async function newPerson(browser: Browser) {
  const context = await browser.newContext({ baseURL: `http://localhost:3100` });
  return { context, page: await context.newPage() };
}
