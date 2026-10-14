import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, schema } from '@/db';

/** Test-only email/password sign-in for Playwright. Must never be on in production. */
export function e2eAuthEnabled(): boolean {
  return process.env.E2E_TEST_AUTH === 'true';
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Test-only sign-in must never be reachable from a public deployment, so it is refused unless
 * the app's base URL is loopback (and always on Vercel production).
 */
export function assertSafeEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.E2E_TEST_AUTH !== 'true') return;
  const host = new URL(env.BETTER_AUTH_URL ?? 'http://localhost:3000').hostname;
  if (env.VERCEL_ENV === 'production' || !LOOPBACK_HOSTS.includes(host)) {
    throw new Error('E2E_TEST_AUTH must never be enabled on a public deployment');
  }
}

export interface ConfiguredProviders {
  google: boolean;
  github: boolean;
}

export function configuredProviders(): ConfiguredProviders {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };
}

function createAuth() {
  assertSafeEnv();
  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const providers = configuredProviders();

  return betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    socialProviders: {
      ...(providers.google && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }),
      ...(providers.github && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
      }),
    },
    emailAndPassword: { enabled: e2eAuthEnabled() },
    // Always on, except under the test-only flag: Playwright signs up many users from one IP.
    rateLimit: { enabled: !e2eAuthEnabled(), window: 60, max: 100 },
    advanced: {
      // Cookies are httpOnly + sameSite=lax by default; `secure` follows the public URL's scheme.
      useSecureCookies: baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __brockAuth?: Auth };

/** Lazy so `next build` doesn't need a database or secrets. */
export function getAuth(): Auth {
  return (globalForAuth.__brockAuth ??= createAuth());
}
