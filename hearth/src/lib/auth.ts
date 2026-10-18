import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { anonymous } from 'better-auth/plugins/anonymous';
import { account, session, user, verification } from '@/db/schema';
import { getDb } from '@/db';
import { mergeUserData } from '@/lib/accounts';
import { env } from '@/lib/env';

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function createAuth() {
  const db = await getDb();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    socialProviders: googleEnabled
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
      : {},
    plugins: [
      anonymous({
        emailDomainName: 'guest.hearth.app',
        generateName: () => 'Guest',
        // Everything a guest did moves to their real account before the guest is deleted.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await mergeUserData(db, anonymousUser.user.id, newUser.user.id);
        },
      }),
      // Must be last: lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

const globalForAuth = globalThis as unknown as { __hearthAuth?: Promise<Auth> };

/** One auth instance per process, created lazily because the database opens asynchronously. */
export function getAuth(): Promise<Auth> {
  globalForAuth.__hearthAuth ??= createAuth();
  return globalForAuth.__hearthAuth;
}
