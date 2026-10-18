import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().default('dev-only-secret-change-me-dev-only-secret'),
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  AWIN_FEED_URLS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  SEED_ON_EMPTY: z.string().optional(),
});

const parsed = schema.safeParse(
  Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])),
);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
