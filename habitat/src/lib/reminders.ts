import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat, installedModule, membership, notification, record } from '@/db/schema';
import { occursOn } from '@/modules/birthdays/upcoming';
import { activeMemberIds, notify, type NewNotification } from './notifications';

const HOUR = 3600_000;

/** Events starting in the next 24 hours get one reminder per member who hasn't said "no". */
export async function sendEventReminders(now = new Date()): Promise<number> {
  const db = getDb();
  const until = new Date(now.getTime() + 24 * HOUR);
  const events = await db
    .select({ r: record })
    .from(record)
    .innerJoin(
      installedModule,
      and(
        eq(installedModule.habitatId, record.habitatId),
        eq(installedModule.moduleId, 'events'),
        isNull(installedModule.removedAt),
      ),
    )
    .innerJoin(habitat, and(eq(habitat.id, record.habitatId), isNull(habitat.deletedAt)))
    .where(
      and(
        eq(record.moduleId, 'events'),
        eq(record.collection, 'event'),
        isNull(record.deletedAt),
        sql`(${record.data}->>'startsAt')::timestamptz > ${now.toISOString()}::timestamptz`,
        sql`(${record.data}->>'startsAt')::timestamptz <= ${until.toISOString()}::timestamptz`,
      ),
    );

  let sent = 0;
  for (const { r: ev } of events) {
    const members = await activeMemberIds(db, ev.habitatId);
    const declined = await db
      .select({ authorId: record.authorId })
      .from(record)
      .where(
        and(
          eq(record.parentId, ev.id),
          isNull(record.deletedAt),
          sql`${record.data}->>'status' = 'no'`,
        ),
      );
    const already = await db
      .select({ userId: notification.userId })
      .from(notification)
      .where(and(eq(notification.recordId, ev.id), eq(notification.type, 'events.reminder')));
    const skip = new Set([...declined.map((d) => d.authorId), ...already.map((a) => a.userId)]);
    const rows: NewNotification[] = members
      .filter((id) => !skip.has(id))
      .map((userId) => ({
        userId,
        habitatId: ev.habitatId,
        type: 'events.reminder',
        recordId: ev.id,
        payload: {
          text: `Coming up: “${String(ev.data.title)}”`,
          title: ev.data.title,
          startsAt: ev.data.startsAt,
          location: ev.data.location ?? null,
          moduleId: 'events',
        },
      }));
    await notify(db, rows);
    sent += rows.length;
  }
  return sent;
}

/** From 09:00 UTC, tell everyone it's someone's birthday. Once per birthday per year. */
export async function sendBirthdayNotices(now = new Date()): Promise<number> {
  if (now.getUTCHours() < 9) return 0;
  const db = getDb();
  const today = now.toISOString().slice(0, 10);
  const rows = await db
    .select({ r: record })
    .from(record)
    .innerJoin(
      installedModule,
      and(
        eq(installedModule.habitatId, record.habitatId),
        eq(installedModule.moduleId, 'birthdays'),
        isNull(installedModule.removedAt),
      ),
    )
    .innerJoin(habitat, and(eq(habitat.id, record.habitatId), isNull(habitat.deletedAt)))
    .where(
      and(
        eq(record.moduleId, 'birthdays'),
        eq(record.collection, 'birthday'),
        isNull(record.deletedAt),
      ),
    );

  let sent = 0;
  for (const { r: b } of rows) {
    if (!b.authorId || !occursOn({ month: Number(b.data.month), day: Number(b.data.day) }, now))
      continue;
    const done = await db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.recordId, b.id),
          eq(notification.type, 'birthdays.today'),
          sql`${notification.payload}->>'date' = ${today}`,
        ),
      )
      .limit(1);
    if (done.length) continue;
    const people = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(and(eq(membership.habitatId, b.habitatId), isNull(membership.leftAt)));
    const ids = people.map((p) => p.userId);
    if (!ids.includes(b.authorId)) continue;
    const out = ids
      .filter((id) => id !== b.authorId)
      .map((userId) => ({
        userId,
        habitatId: b.habitatId,
        type: 'birthdays.today',
        actorId: b.authorId,
        recordId: b.id,
        payload: { text: 'It’s a birthday today 🎂', date: today, moduleId: 'birthdays' },
      }));
    await notify(db, out);
    sent += out.length;
  }
  return sent;
}
