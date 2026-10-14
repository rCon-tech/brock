import { describe, expect, it } from 'vitest';
import {
  cookieOptions,
  hashRecoveryCode,
  hashToken,
  isWellFormedRecoveryCode,
  newRecoveryCode,
  newToken,
  normalizeRecoveryCode,
  sameHash,
} from '@/lib/identity';

describe('tokens', () => {
  it('are long, URL-safe and never repeat', () => {
    const tokens = new Set(Array.from({ length: 1000 }, newToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hash to a stable sha256 that differs from the token', () => {
    // printf 'abc' | sha256sum
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abd')).not.toBe(hashToken('abc'));
  });
});

describe('sameHash', () => {
  it('compares equal hashes, and rejects different, empty or malformed ones', () => {
    const h = hashToken('x');
    expect(sameHash(h, h)).toBe(true);
    expect(sameHash(h, hashToken('y'))).toBe(false);
    expect(sameHash(h, '')).toBe(false);
    expect(sameHash('', '')).toBe(false);
    expect(sameHash(h, '00')).toBe(false);
  });
});

describe('recovery codes', () => {
  it('look like XXXX-XXXX-XXXX-XXXX with an unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = newRecoveryCode();
      expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      expect(code).not.toMatch(/[01ILOU]/);
    }
  });

  it('never repeat', () => {
    expect(new Set(Array.from({ length: 2000 }, newRecoveryCode)).size).toBe(2000);
  });

  it('normalise casing and separators, so a hand-typed code still works', () => {
    const code = newRecoveryCode();
    const sloppy = ` ${code.toLowerCase().replaceAll('-', ' · ')}\n`;
    expect(normalizeRecoveryCode(sloppy)).toBe(code.replaceAll('-', ''));
    expect(hashRecoveryCode(sloppy)).toBe(hashRecoveryCode(code));
  });

  it('validate shape', () => {
    expect(isWellFormedRecoveryCode(normalizeRecoveryCode(newRecoveryCode()))).toBe(true);
    expect(isWellFormedRecoveryCode('')).toBe(false);
    expect(isWellFormedRecoveryCode('ABCD')).toBe(false);
    expect(isWellFormedRecoveryCode('A'.repeat(17))).toBe(false);
    expect(isWellFormedRecoveryCode('0'.repeat(16))).toBe(false); // 0 isn't in the alphabet
  });
});

describe('cookieOptions', () => {
  it('is httpOnly, lax and site-wide for about a year', () => {
    expect(cookieOptions('')).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(cookieOptions('').maxAge).toBe(400 * 24 * 60 * 60);
  });

  it('is Secure only when the public URL is https, so http://localhost still works', () => {
    expect(cookieOptions('https://brock.example.com').secure).toBe(true);
    expect(cookieOptions('http://localhost:3000').secure).toBe(false);
    expect(cookieOptions('').secure).toBe(false);
  });
});
