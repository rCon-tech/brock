import { cronRoute } from '@/lib/cron';
import { sendPendingEmails } from '@/lib/email-notifications';
import { sendBirthdayNotices, sendEventReminders } from '@/lib/reminders';

export const GET = cronRoute(async () => {
  const events = await sendEventReminders();
  const birthdays = await sendBirthdayNotices();
  const emails = await sendPendingEmails();
  return { events, birthdays, emails };
});
