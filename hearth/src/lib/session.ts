import { headers } from 'next/headers';
import { AppError } from '@/lib/errors';
import { getAuth } from '@/lib/auth';

export interface SessionUser {
  id: string;
  name: string;
  isAnonymous: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Read the request first: it marks the page as dynamic, so a build never opens the database.
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    isAnonymous: Boolean((session.user as { isAnonymous?: boolean | null }).isAnonymous),
  };
}

/** For pages and route handlers that need someone signed in (guests count). */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new AppError('Please start again from the home page.', 401, 'unauthorized');
  return user.id;
}

/**
 * For actions that can start a visit: gives first-time visitors a guest session so nobody has
 * to sign up before getting value (R2). Only call from server actions and route handlers,
 * which are allowed to set cookies.
 */
export async function ensureUserId(): Promise<string> {
  const existing = await getSessionUser();
  if (existing) return existing.id;
  const requestHeaders = await headers();
  const auth = await getAuth();
  const created = await auth.api.signInAnonymous({ headers: requestHeaders });
  if (!created?.user?.id) throw new AppError('Could not start a session. Please try again.', 500);
  return created.user.id;
}
