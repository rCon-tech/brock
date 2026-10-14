import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { THROWS, type Throw } from './game';

/** The House's pick. Always uses a CSPRNG, never Math.random. */
export function houseThrow(): Throw {
  return THROWS[randomInt(THROWS.length)];
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

/** The commitment shown to the player before they throw: sha256("<throw>:<salt>"). */
export function commit(houseThrowValue: Throw, salt: string): string {
  return createHash('sha256').update(`${houseThrowValue}:${salt}`).digest('hex');
}

export function verify(hash: string, houseThrowValue: Throw, salt: string): boolean {
  const expected = Buffer.from(commit(houseThrowValue, salt), 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
