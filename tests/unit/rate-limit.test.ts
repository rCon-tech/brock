import { beforeEach, describe, expect, it } from 'vitest';
import { allow, resetRateLimits } from '@/lib/rate-limit';

beforeEach(() => resetRateLimits());

describe('allow', () => {
  it('permits up to the limit within a window, then blocks', () => {
    for (let i = 0; i < 3; i++) expect(allow('k', 3, 1000, 0)).toBe(true);
    expect(allow('k', 3, 1000, 500)).toBe(false);
    expect(allow('k', 3, 1000, 999)).toBe(false);
  });

  it('starts a fresh window once the old one expires', () => {
    for (let i = 0; i < 3; i++) allow('k', 3, 1000, 0);
    expect(allow('k', 3, 1000, 1000)).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(allow('a', 1, 1000, 0)).toBe(true);
    expect(allow('a', 1, 1000, 0)).toBe(false);
    expect(allow('b', 1, 1000, 0)).toBe(true);
  });

  it('does not extend the window when blocked calls keep coming', () => {
    allow('k', 1, 1000, 0);
    for (let t = 100; t < 1000; t += 100) expect(allow('k', 1, 1000, t)).toBe(false);
    expect(allow('k', 1, 1000, 1000)).toBe(true);
  });
});
