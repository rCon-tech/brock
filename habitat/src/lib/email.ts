import { getDb } from '@/db';
import { emailOutbox } from '@/db/schema';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * EMAIL_TRANSPORT: `console` (dev, prints), `outbox` (tests, writes to `email_outbox`),
 * `resend` (production).
 */
export async function sendEmail(mail: Email): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? 'console';
  if (transport === 'outbox') {
    await getDb().insert(emailOutbox).values(mail);
    return;
  }
  if (transport === 'resend') {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Habitat <hello@example.com>',
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    return;
  }
  console.log(`\n--- email to ${mail.to}: ${mail.subject}\n${mail.text}\n---\n`);
}
