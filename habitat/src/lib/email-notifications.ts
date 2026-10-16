import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat, notification, proposal, user } from '@/db/schema';
import { EventReminderEmail } from '@/emails/EventReminderEmail';
import { ProposalEmail } from '@/emails/ProposalEmail';
import { renderEmail } from '@/emails/render';
import { getManifest } from '@/modules/registry';
import { sendEmail } from './email';

const EMAILED = ['proposal.opened', 'proposal.decided', 'events.reminder'] as const;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Email the notifications that deserve one, to people who haven't opted out. Runs after the
 * transaction that created them, from cron, so a mail failure can never undo an action.
 */
export async function sendPendingEmails(now = new Date(), limit = 200): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      n: notification,
      u: {
        email: user.email,
        name: user.name,
        prefs: user.emailPrefs,
        verified: user.emailVerified,
      },
      h: { slug: habitat.slug, name: habitat.name, emoji: habitat.emoji },
    })
    .from(notification)
    .innerJoin(user, eq(user.id, notification.userId))
    .innerJoin(habitat, eq(habitat.id, notification.habitatId))
    .where(
      and(
        isNull(notification.emailedAt),
        inArray(notification.type, [...EMAILED]),
        gt(notification.createdAt, new Date(now.getTime() - 24 * 3600_000)),
      ),
    )
    .limit(limit);

  let sent = 0;
  for (const { n, u, h } of rows) {
    const allowed =
      u.verified && (n.type === 'events.reminder' ? u.prefs.events : u.prefs.proposals);
    if (allowed) {
      try {
        const mail = await build(n, h);
        if (mail) {
          await sendEmail({ to: u.email, ...mail });
          sent++;
        }
      } catch (e) {
        console.error('Notification email failed', n.id, e);
        continue; // leave emailed_at unset so the next run retries
      }
    }
    await db.update(notification).set({ emailedAt: now }).where(eq(notification.id, n.id));
  }
  return sent;
}

async function build(
  n: typeof notification.$inferSelect,
  h: { slug: string; name: string; emoji: string },
): Promise<{ subject: string; html: string; text: string } | null> {
  const base = `${appUrl()}/h/${h.slug}`;
  if (n.type === 'events.reminder') {
    const startsAt = new Date(String(n.payload.startsAt));
    const when = startsAt.toUTCString().replace(' GMT', ' UTC');
    const subject = `Tomorrow: ${String(n.payload.title)}`;
    const body = await renderEmail(
      EventReminderEmail({
        habitat: h.name,
        title: String(n.payload.title),
        when,
        where: n.payload.location ? String(n.payload.location) : undefined,
        url: `${base}/m/events/${n.recordId}`,
      }),
    );
    return { subject, ...body };
  }

  if (!n.proposalId) return null;
  const [p] = await getDb().select().from(proposal).where(eq(proposal.id, n.proposalId));
  if (!p) return null;
  const name = (p.moduleId && getManifest(p.moduleId)?.name) || 'a setting';
  const what =
    p.kind === 'install'
      ? `add ${name}`
      : p.kind === 'uninstall'
        ? `remove ${name}`
        : p.kind === 'governance'
          ? 'change how votes work'
          : `change ${name} settings`;
  if (n.type === 'proposal.opened') {
    const headline = `Vote: ${what}?`;
    const body = await renderEmail(
      ProposalEmail({
        habitat: h.name,
        headline,
        detail: p.reason ? `“${p.reason}”` : 'Someone in your group has proposed a change.',
        url: `${base}/proposals`,
        cta: 'Vote now',
      }),
    );
    return { subject: `${h.emoji} ${h.name}: ${headline}`, ...body };
  }
  const passed = n.payload.status === 'passed';
  const headline = passed ? `Passed: ${what}` : `Didn’t pass: ${what}`;
  const body = await renderEmail(
    ProposalEmail({
      habitat: h.name,
      headline,
      detail: 'The vote has finished.',
      url: `${base}/proposals`,
      cta: 'See the result',
    }),
  );
  return { subject: `${h.emoji} ${h.name}: ${headline}`, ...body };
}
