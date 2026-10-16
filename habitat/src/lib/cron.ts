import { timingSafeEqual } from 'node:crypto';
import { DomainError } from './errors';
import { json } from './api';

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. No secret configured means no access. */
export function assertCronRequest(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret ?? ''}`;
  const ok =
    !!secret &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) throw new DomainError('unauthenticated', 401, 'Not allowed.');
}

export function cronRoute(job: () => Promise<Record<string, unknown>>) {
  return async (req: Request) => {
    try {
      assertCronRequest(req);
      return json({ ok: true, ...(await job()) });
    } catch (e) {
      if (e instanceof DomainError)
        return json({ error: { code: e.code, message: e.message } }, e.status);
      console.error('Cron job failed', e);
      return json({ error: { code: 'internal', message: 'Job failed.' } }, 500);
    }
  };
}
