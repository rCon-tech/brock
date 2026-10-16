import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters'),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  EMAIL_TRANSPORT: z.enum(['console', 'outbox', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Habitat <hello@example.com>'),
  CRON_SECRET: z.string().optional(),
  ABLY_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('habitat-media'),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Parsed lazily (not at import) so `next build` and unit tests don't need a full environment. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    if (e.EMAIL_TRANSPORT === 'outbox') throw new Error('EMAIL_TRANSPORT=outbox is for tests only');
    if (e.EMAIL_TRANSPORT === 'resend' && !e.RESEND_API_KEY)
      throw new Error('RESEND_API_KEY is required');
    if (!e.CRON_SECRET) throw new Error('CRON_SECRET is required in production');
  }
  return (cached = e);
}

export const photosEnabled = () =>
  !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
