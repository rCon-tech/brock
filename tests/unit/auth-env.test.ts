import { describe, expect, it } from 'vitest';
import { assertSafeEnv } from '@/lib/auth';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('assertSafeEnv (test-only sign-in guard)', () => {
  it('is a no-op when test auth is off, whatever the environment', () => {
    expect(() =>
      assertSafeEnv(
        env({ BETTER_AUTH_URL: 'https://brock.example.com', VERCEL_ENV: 'production' }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSafeEnv(env({ E2E_TEST_AUTH: 'false', VERCEL_ENV: 'production' })),
    ).not.toThrow();
  });

  it('allows test auth on a loopback URL', () => {
    for (const url of ['http://localhost:3100', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      expect(() =>
        assertSafeEnv(env({ E2E_TEST_AUTH: 'true', BETTER_AUTH_URL: url })),
      ).not.toThrow();
    }
    expect(() => assertSafeEnv(env({ E2E_TEST_AUTH: 'true' }))).not.toThrow();
  });

  it('refuses test auth on a public URL', () => {
    expect(() =>
      assertSafeEnv(env({ E2E_TEST_AUTH: 'true', BETTER_AUTH_URL: 'https://brock.example.com' })),
    ).toThrow(/E2E_TEST_AUTH/);
  });

  it('refuses test auth on Vercel production even with a loopback URL', () => {
    expect(() =>
      assertSafeEnv(
        env({
          E2E_TEST_AUTH: 'true',
          BETTER_AUTH_URL: 'http://localhost:3000',
          VERCEL_ENV: 'production',
        }),
      ),
    ).toThrow(/E2E_TEST_AUTH/);
  });

  it('refuses lookalike hostnames', () => {
    expect(() =>
      assertSafeEnv(env({ E2E_TEST_AUTH: 'true', BETTER_AUTH_URL: 'https://localhost.evil.com' })),
    ).toThrow();
  });
});
