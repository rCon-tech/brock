import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { user } from '@/db/schema';
import { getAuth } from './auth';

export type CurrentUser = typeof user.$inferSelect;

async function load(h: Headers): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;
  const [u] = await getDb().select().from(user).where(eq(user.id, session.user.id));
  return u ?? null;
}

/** The signed-in user for this request (server components, actions). Cached per request. */
export const getCurrentUser = cache(async () => load(await headers()));

/** For pages: redirect to /login (or /onboarding for brand-new accounts). */
export async function requireUser(
  opts: { allowUnonboarded?: boolean; next?: string } = {},
): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(opts.next ? `/login?next=${encodeURIComponent(opts.next)}` : '/login');
  if (!u.onboardedAt && !opts.allowUnonboarded) {
    redirect(opts.next ? `/onboarding?next=${encodeURIComponent(opts.next)}` : '/onboarding');
  }
  return u;
}

/** For route handlers, which have the Request in hand. */
export async function userFromRequest(req: Request): Promise<CurrentUser | null> {
  return load(req.headers);
}
