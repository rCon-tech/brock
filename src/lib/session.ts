import { cookies, headers } from 'next/headers';
import type { Player } from '@/db/schema';
import { DomainError } from './errors';
import { COOKIE_NAME, cookieOptions, hashToken, newToken } from './identity';
import { createAnonymousPlayer, getPlayerByToken } from './players';
import { allow } from './rate-limit';

/** New anonymous players one IP may create per hour. Raise it for events on shared Wi-Fi. */
const NEW_PLAYERS_PER_IP = Number(process.env.MAX_NEW_PLAYERS_PER_IP_HOUR) || 30;
const NEW_PLAYER_WINDOW_MS = 60 * 60_000;

/** Read-only: safe in server components. Null when the browser has no (valid) identity cookie. */
export async function getCurrentPlayer(): Promise<Player | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? getPlayerByToken(token) : null;
}

/** For API routes that need an existing player: 401 without one. */
export async function requirePlayer(): Promise<Player> {
  const current = await getCurrentPlayer();
  if (!current) throw new DomainError('unauthorized');
  return current;
}

/** Stores a (new) identity token in the browser. Route handlers and server actions only. */
export async function setIdentityCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, cookieOptions());
}

/**
 * Route handlers only. Returns this browser's player, creating one (and setting the cookie)
 * on first visit. Creation is rate limited per IP so it can't be used to flood the table.
 */
export async function getOrCreatePlayer(): Promise<Player> {
  const jar = await cookies();
  const existingToken = jar.get(COOKIE_NAME)?.value;
  if (existingToken) {
    const existing = await getPlayerByToken(existingToken);
    if (existing) {
      // Keep the cookie sliding so an active player never expires.
      await setIdentityCookie(existingToken);
      return existing;
    }
  }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`new-player:${ip}`, NEW_PLAYERS_PER_IP, NEW_PLAYER_WINDOW_MS)) {
    throw new DomainError('rate_limited');
  }

  const token = newToken();
  const created = await createAnonymousPlayer(hashToken(token));
  await setIdentityCookie(token);
  return created;
}
