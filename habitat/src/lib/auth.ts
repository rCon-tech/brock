import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { getDb, schema } from '@/db';
import { MagicLinkEmail } from '@/emails/MagicLinkEmail';
import { renderEmail } from '@/emails/render';
import { env } from '@/env';
import { sendEmail } from './email';
import { rateLimit } from './rate-limit';

function create() {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : undefined;

  return betterAuth({
    baseURL: e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.NEXT_PUBLIC_APP_URL],
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    socialProviders: google,
    rateLimit: { enabled: true },
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          // Per address, on top of Better Auth's own limit, so one inbox can't be flooded.
          await rateLimit(`magic:${email.toLowerCase()}`, 5, 3600);
          const { html, text } = await renderEmail(MagicLinkEmail({ url }));
          await sendEmail({ to: email, subject: 'Your Habitat sign-in link', html, text });
        },
      }),
      nextCookies(), // keep last
    ],
  });
}

let instance: ReturnType<typeof create> | undefined;

/** Lazy: Better Auth opens the database on construction, which must not happen at build time. */
export function getAuth() {
  return (instance ??= create());
}
