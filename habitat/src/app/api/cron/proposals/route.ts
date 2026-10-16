import { cronRoute } from '@/lib/cron';
import { sendPendingEmails } from '@/lib/email-notifications';
import { closeExpired } from '@/lib/proposals';

export const GET = cronRoute(async () => {
  const closed = await closeExpired();
  const emails = await sendPendingEmails();
  return { closed, emails };
});
