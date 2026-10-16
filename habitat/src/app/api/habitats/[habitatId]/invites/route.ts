import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat } from '@/db/schema';
import { created, habitatRoute, parseBody } from '@/lib/api';
import { InviteEmail } from '@/emails/InviteEmail';
import { renderEmail } from '@/emails/render';
import { env } from '@/env';
import { sendEmail } from '@/lib/email';
import { createInvite, listInvites } from '@/lib/invites';
import { rateLimit } from '@/lib/rate-limit';
import { CreateInviteBody } from '@/lib/validation';

type P = { habitatId: string };

export const GET = habitatRoute<P>(async ({ member }) => ({ invites: await listInvites(member) }));

export const POST = habitatRoute<P>(async ({ req, member, user }) => {
  const { email, ...opts } = await parseBody(req, CreateInviteBody);
  if (email) await rateLimit(`invite-email:${user.id}`, 10, 3600);
  const { code, invite } = await createInvite(member, opts);
  const url = `${env().NEXT_PUBLIC_APP_URL}/join/${code}`;
  if (email) {
    const [h] = await getDb().select().from(habitat).where(eq(habitat.id, member.habitatId));
    const body = await renderEmail(InviteEmail({ inviter: user.name, habitat: h!.name, emoji: h!.emoji, url }));
    await sendEmail({ to: email, subject: `${user.name} invited you to ${h!.name} on Habitat`, ...body });
  }
  return created({ id: invite.id, code, url, expiresAt: invite.expiresAt.toISOString(), emailed: !!email });
});
