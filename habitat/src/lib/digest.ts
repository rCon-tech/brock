import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat, membership, proposal, proposalVote, record, user } from '@/db/schema';
import { DigestEmail, type DigestSection } from '@/emails/DigestEmail';
import { renderEmail } from '@/emails/render';
import { sendEmail } from './email';
import { listActive } from './installed-modules';
import { timelinePairs } from './timeline';

const DAY = 86400_000;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Weekly: per person, per Habitat, only what's new. Sections with nothing to say are dropped. */
export async function sendDigests(now = new Date()): Promise<number> {
  const db = getDb();
  const people = await db.select().from(user).where(eq(user.emailVerified, true));
  let sent = 0;
  for (const u of people) {
    if (!u.emailPrefs.digest) continue;
    const mine = await db
      .select({ h: habitat })
      .from(membership)
      .innerJoin(habitat, and(eq(habitat.id, membership.habitatId), isNull(habitat.deletedAt)))
      .where(and(eq(membership.userId, u.id), isNull(membership.leftAt)));

    const sections: DigestSection[] = [];
    for (const { h } of mine) {
      const active = await listActive(db, h.id);
      const pairs = timelinePairs(active);
      const week = new Date(now.getTime() - 7 * DAY);

      let newPosts = 0;
      if (pairs.length) {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(record)
          .where(
            and(
              eq(record.habitatId, h.id),
              isNull(record.deletedAt),
              gt(record.createdAt, week),
              sql`${record.authorId} is distinct from ${u.id}`,
              sql`(${record.moduleId}, ${record.collection}) in (${sql.join(
                pairs.map((p) => sql`(${p.module}, ${p.collection})`),
                sql`, `,
              )})`,
            ),
          );
        newPosts = n;
      }

      const events = active.some((a) => a.manifest.id === 'events')
        ? (
            await db
              .select({ data: record.data })
              .from(record)
              .where(
                and(
                  eq(record.habitatId, h.id),
                  eq(record.moduleId, 'events'),
                  eq(record.collection, 'event'),
                  isNull(record.deletedAt),
                  sql`(${record.data}->>'startsAt')::timestamptz > ${now.toISOString()}::timestamptz`,
                  sql`(${record.data}->>'startsAt')::timestamptz <= ${new Date(now.getTime() + 7 * DAY).toISOString()}::timestamptz`,
                ),
              )
              .limit(5)
          ).map((e) => ({
            title: String(e.data.title),
            when: new Date(String(e.data.startsAt)).toUTCString().replace(' GMT', ' UTC'),
          }))
        : [];

      const open = await db
        .select({ id: proposal.id })
        .from(proposal)
        .where(
          and(
            eq(proposal.habitatId, h.id),
            eq(proposal.status, 'open'),
            gt(proposal.closesAt, now),
            sql`not exists (select 1 from ${proposalVote} v where v.proposal_id = ${proposal.id} and v.user_id = ${u.id})`,
          ),
        );

      if (newPosts || events.length || open.length) {
        sections.push({ habitat: h.name, emoji: h.emoji, url: `${appUrl()}/h/${h.slug}`, newPosts, events, openVotes: open.length });
      }
    }
    if (!sections.length) continue;
    const body = await renderEmail(DigestEmail({ name: u.name, sections, settingsUrl: `${appUrl()}/settings` }));
    await sendEmail({ to: u.email, subject: 'Your week in Habitat', ...body });
    sent++;
  }
  return sent;
}
