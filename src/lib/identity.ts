import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

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

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

/** No 0/1/I/L/O/U, so codes survive being read aloud or copied by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 16;

/** 16 random characters (~78 bits) shown as XXXX-XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const chars = Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  );
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

/** Accepts any casing and separators the player typed. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isWellFormedRecoveryCode(normalized: string): boolean {
  return (
    normalized.length === CODE_LENGTH && [...normalized].every((c) => CODE_ALPHABET.includes(c))
  );
}

export function hashRecoveryCode(input: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(input)).digest('hex');
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
