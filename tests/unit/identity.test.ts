import { describe, expect, it } from 'vitest';
import { cookieOptions, hashToken, newToken } from '@/lib/identity';

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
