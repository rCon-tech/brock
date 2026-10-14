import { headers } from 'next/headers';
import type { Player } from '@/db/schema';
import { getAuth } from './auth';
import { DomainError } from './errors';
import { getPlayerByUserId } from './players';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** For API routes: throws 401 when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new DomainError('unauthorized');
  return user;
}

/** For API routes: throws 401 when signed out, 403 when the user hasn't chosen a handle yet. */
export async function requirePlayer(): Promise<{ user: SessionUser; player: Player }> {
  const user = await requireUser();
  const player = await getPlayerByUserId(user.id);
  if (!player) throw new DomainError('onboarding_required');
  return { user, player };
}

export type Viewer =
  | { state: 'signed_out' }
  | { state: 'needs_handle'; user: SessionUser }
  | { state: 'player'; user: SessionUser; player: Player };

/** For pages: never throws, tells the page which of the three states the visitor is in. */
export async function getViewer(): Promise<Viewer> {
  const user = await getSessionUser();
  if (!user) return { state: 'signed_out' };
  const player = await getPlayerByUserId(user.id);
  return player ? { state: 'player', user, player } : { state: 'needs_handle', user };
}
