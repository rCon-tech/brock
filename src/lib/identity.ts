import { createHash, randomBytes } from 'node:crypto';

/** Cookie holding the player's secret token. Only its hash is stored server-side. */
export const COOKIE_NAME = 'brock_id';
/** Browsers cap cookie lifetime at about 400 days, so ask for exactly that. */
export const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function cookieOptions(siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Secure cookies need https; follow the public URL so http://localhost still works.
    secure: siteUrl.startsWith('https://'),
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}
