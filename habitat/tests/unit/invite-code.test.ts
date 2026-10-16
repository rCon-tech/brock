import { describe, expect, it } from 'vitest';
import { hashCode, isValidCode, newCode, normalise } from '@/lib/invite-code';

describe('invite codes', () => {
  it('are 10 valid characters', () => {
    for (let i = 0; i < 200; i++) expect(isValidCode(newCode())).toBe(true);
  });
  it('are not repeated', () => {
    expect(new Set(Array.from({ length: 1000 }, newCode)).size).toBe(1000);
  });
  it('normalise look-alikes, case, spaces and hyphens', () => {
    expect(normalise('abcde-fghjk')).toBe('ABCDEFGH1K'.replace('H1K', 'HJK'));
    expect(normalise('o0 iIlL')).toBe('0011' + '11');
  });
  it('rejects wrong length and bad characters', () => {
    expect(isValidCode('ABC')).toBe(false);
    expect(isValidCode('ABCDEFGHI!')).toBe(false);
    expect(isValidCode('ABCDEFGHIU')).toBe(false);
  });
  it('hash is stable sha256 hex and differs per code', () => {
    expect(hashCode('0123456789')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode('0123456789')).toBe(hashCode('0123456789'));
    expect(hashCode('0123456789')).not.toBe(hashCode('0123456780'));
  });
});
