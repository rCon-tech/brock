import { describe, expect, it } from 'vitest';
import { isReserved, slugify, withSuffix } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Lads!')).toBe('the-lads');
    expect(slugify('  Five-a-side  FC ')).toBe('five-a-side-fc');
  });
  it('strips accents and expands &', () => {
    expect(slugify('Café Crew')).toBe('cafe-crew');
    expect(slugify('Tom & Jerry')).toBe('tom-and-jerry');
  });
  it('pads very short names to the 3 character minimum', () => {
    expect(slugify('Hi').length).toBeGreaterThanOrEqual(3);
    expect(slugify('🎉🎉🎉').length).toBeGreaterThanOrEqual(3);
  });
  it('caps length at 40 with no trailing hyphen', () => {
    const s = slugify('a'.repeat(39) + ' b' + ' c');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('withSuffix', () => {
  it('adds -2, -3', () => {
    expect(withSuffix('the-lads', 1)).toBe('the-lads');
    expect(withSuffix('the-lads', 2)).toBe('the-lads-2');
    expect(withSuffix('the-lads', 13)).toBe('the-lads-13');
  });
  it('stays within 40 characters', () => {
    expect(withSuffix('a'.repeat(40), 12).length).toBe(40);
  });
});

it('reserves route names', () => {
  expect(isReserved('new')).toBe(true);
  expect(isReserved('the-lads')).toBe(false);
});
