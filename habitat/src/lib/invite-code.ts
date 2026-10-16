import { createHash, randomBytes } from 'node:crypto';

// Crockford base32: no I, L, O or U, so codes survive being read aloud or typed from a screenshot.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 10; // 10 x 5 bits = 50 bits

export function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i]! & 31];
  return out;
}

/** Uppercase, drop spaces and hyphens, map look-alikes (O→0, I/L→1). */
export function normalise(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/** Only this hash is stored; the code itself is shown once. */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
