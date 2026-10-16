import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { assertCronRequest } from '@/lib/cron';
import { sendDigests } from '@/lib/digest';
import { sendPendingEmails } from '@/lib/email-notifications';
import { propose } from '@/lib/proposals';
import { createRecord } from '@/lib/records';
import { sendBirthdayNotices, sendEventReminders } from '@/lib/reminders';
import { makeHabitat } from './factories';

const HOUR = 3600_000;
const ev = (title: string, startsAt: Date) => ({
  module: 'events',
  collection: 'event',
  data: { title, startsAt: startsAt.toISOString() },
});

describe('cron auth', () => {
  it('requires the bearer secret', () => {
    process.env.CRON_SECRET = 's3cret-s3cret';
    const req = (auth?: string) => new Request('http://x/api/cron/purge', { headers: auth ? { authorization: auth } : {} });
    expect(() => assertCronRequest(req())).toThrow();
    expect(() => assertCronRequest(req('Bearer wrong'))).toThrow();
    expect(() => assertCronRequest(req('Bearer s3cret-s3cret'))).not.toThrow();
    delete process.env.CRON_SECRET;
    expect(() => assertCronRequest(req('Bearer '))).toThrow(); // no secret configured: closed, not open
  });
});

describe('event reminders', () => {
  it('reminds members of events in the next 24h, once, skipping those who said no', async () => {
    const h = await makeHabitat({ members: 3 });
    const now = new Date('2026-06-01T12:00:00Z');
    const soon = await createRecord(h.members[0]!, ev('Pub', new Date(now.getTime() + 20 * HOUR)), now);
    await createRecord(h.members[0]!, ev('Next week', new Date(now.getTime() + 100 * HOUR)), now);
    await createRecord(h.members[0]!, ev('Past', new Date(now.getTime() - HOUR)), now);
    await createRecord(h.members[2]!, { module: 'events', collection: 'rsvp', parentId: soon.id, data: { status: 'no' } }, now);
    await getDb().delete(s.notification);

    expect(await sendEventReminders(now)).toBe(2);
    const n = await getDb().select().from(s.notification).where(eq(s.notification.type, 'events.reminder'));
    expect(n.map((x) => x.userId).sort()).toEqual([h.members[0]!.userId, h.members[1]!.userId].sort());
    expect(await sendEventReminders(new Date(now.getTime() + HOUR))).toBe(0); // idempotent
  });

  it('ignores events of an uninstalled events module', async () => {
    const h = await makeHabitat({ members: 2 });
    const now = new Date('2026-06-01T12:00:00Z');
    await createRecord(h.members[0]!, ev('Pub', new Date(now.getTime() + HOUR)), now);
    await getDb().update(s.installedModule).set({ removedAt: now }).where(eq(s.installedModule.moduleId, 'events'));
    expect(await sendEventReminders(now)).toBe(0);
  });
});

describe('birthday notices', () => {
  it('tell everyone else from 09:00 UTC, once per year', async () => {
    const h = await makeHabitat({ members: 3, extraModules: ['birthdays'] });
    await createRecord(h.members[1]!, { module: 'birthdays', collection: 'birthday', data: { month: 6, day: 1 } });
    await getDb().delete(s.notification);
    expect(await sendBirthdayNotices(new Date('2026-06-01T08:59:00Z'))).toBe(0);
    expect(await sendBirthdayNotices(new Date('2026-06-01T09:05:00Z'))).toBe(2);
    expect(await sendBirthdayNotices(new Date('2026-06-01T15:00:00Z'))).toBe(0);
    expect(await sendBirthdayNotices(new Date('2026-06-02T10:00:00Z'))).toBe(0);
    const n = await getDb().select().from(s.notification);
    expect(n.some((x) => x.userId === h.members[1]!.userId)).toBe(false);
  });
});

describe('emails', () => {
  it('emails proposals to members who opted in, once, and respects opt-out', async () => {
    const h = await makeHabitat({ members: 3 });
    await getDb()
      .update(s.user)
      .set({ emailPrefs: { digest: true, events: true, proposals: false } })
      .where(eq(s.user.id, h.members[2]!.userId));
    await propose(h.members[0]!, { kind: 'install', moduleId: 'polls', reason: 'Settle the pizza debate' });
    const sent = await sendPendingEmails();
    expect(sent).toBe(1);
    const box = await getDb().select().from(s.emailOutbox);
    expect(box).toHaveLength(1);
    expect(box[0]!.subject).toContain('Vote: add Polls');
    expect(box[0]!.html).toContain('Settle the pizza debate');
    expect(box[0]!.html).toContain('/proposals');
    expect(await sendPendingEmails()).toBe(0);
  });

  it('emails the outcome of a vote', async () => {
    const h = await makeHabitat({ members: 2 });
    const { vote } = await import('@/lib/proposals');
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await sendPendingEmails();
    await vote(h.members[1]!, p.id, 'yes');
    await sendPendingEmails();
    const subjects = (await getDb().select().from(s.emailOutbox)).map((m) => m.subject);
    expect(subjects.some((x) => x.includes('Passed: add Polls'))).toBe(true);
  });
});

describe('weekly digest', () => {
  it('summarises new posts, upcoming events and open votes, and skips quiet Habitats', async () => {
    const quiet = await makeHabitat({ members: 2 });
    const busy = await makeHabitat({ members: 2 });
    const now = new Date('2026-06-08T08:00:00Z');
    await createRecord(busy.members[0]!, { module: 'feed', collection: 'post', data: { text: 'hello' } }, new Date('2026-06-05T10:00:00Z'));
    await createRecord(busy.members[0]!, ev('Pub quiz', new Date('2026-06-10T19:00:00Z')), new Date('2026-06-05T10:00:00Z'));
    await propose(busy.members[0]!, { kind: 'install', moduleId: 'polls' }, new Date('2026-06-07T10:00:00Z'));

    const sent = await sendDigests(now);
    expect(sent).toBe(2); // both people in the busy Habitat; nobody in the quiet one
    const box = await getDb().select().from(s.emailOutbox);
    expect(box.length).toBeGreaterThanOrEqual(1);
    const mail = box.find((m) => m.html.includes('Pub quiz'))!;
    expect(mail.html).toContain(busy.slug);
    expect(box.every((m) => !m.html.includes(quiet.slug))).toBe(true);
  });

  it('respects the digest opt-out', async () => {
    const h = await makeHabitat({ members: 2 });
    const now = new Date('2026-06-08T08:00:00Z');
    await createRecord(h.members[0]!, ev('Pub', new Date('2026-06-10T19:00:00Z')), now);
    for (const m of h.members) {
      await getDb().update(s.user).set({ emailPrefs: { digest: false, events: true, proposals: true } }).where(eq(s.user.id, m.userId));
    }
    expect(await sendDigests(now)).toBe(0);
  });
});
