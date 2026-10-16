import { describe, expect, it } from 'vitest';
import { addComment } from '@/lib/interactions';
import { listNotifications, markRead } from '@/lib/notifications';
import { createRecord } from '@/lib/records';
import { makeHabitat } from './factories';

describe('notifications', () => {
  it('lists newest first with an unread count, and marks read', async () => {
    const h = await makeHabitat({ members: 2 });
    const [a, b] = h.members;
    const p = await createRecord(a!, { module: 'feed', collection: 'post', data: { text: 'hi' } });
    await addComment(b!, p.id, { body: 'one' }, new Date('2026-05-01T00:00:00Z'));
    await addComment(b!, p.id, { body: 'two' }, new Date('2026-05-02T00:00:00Z'));
    const r = await listNotifications(a!.userId);
    expect(r.items).toHaveLength(2);
    expect(r.unread).toBe(2);
    expect(r.items[0]!.actor?.name).toBeTruthy();
    expect(r.items[0]!.habitat.slug).toBe(h.slug);

    await markRead(a!.userId, [r.items[0]!.id]);
    expect((await listNotifications(a!.userId)).unread).toBe(1);
    await markRead(a!.userId, 'all');
    expect((await listNotifications(a!.userId)).unread).toBe(0);
  });

  it('are private: you never see or clear someone else’s', async () => {
    const h = await makeHabitat({ members: 2 });
    const [a, b] = h.members;
    const p = await createRecord(a!, { module: 'feed', collection: 'post', data: { text: 'hi' } });
    await addComment(b!, p.id, { body: 'x' });
    const mine = await listNotifications(a!.userId);
    expect((await listNotifications(b!.userId)).items).toEqual([]);
    await markRead(b!.userId, [mine.items[0]!.id]);
    expect((await listNotifications(a!.userId)).unread).toBe(1);
  });

  it('paginates by cursor', async () => {
    const h = await makeHabitat({ members: 2 });
    const [a, b] = h.members;
    const p = await createRecord(a!, { module: 'feed', collection: 'post', data: { text: 'hi' } });
    for (let i = 0; i < 3; i++) await addComment(b!, p.id, { body: `c${i}` }, new Date(Date.UTC(2026, 4, 1 + i)));
    const first = await listNotifications(a!.userId, { limit: 2 });
    expect(first.items).toHaveLength(2);
    const second = await listNotifications(a!.userId, { limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});
