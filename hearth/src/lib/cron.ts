import { env } from '@/lib/env';

/**
 * Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`. With no secret configured the
 * routes refuse everything, so a forgotten setting can never expose them.
 */
export function isAuthorisedCron(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  return request.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`;
}
