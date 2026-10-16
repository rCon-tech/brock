import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { createRecord, deleteRecord, getRecord, queryRecords, updateRecord } from '@/lib/records';
import { makeHabitat, makeMedia, setRole } from './factories';

const post = (text: string) => ({ module: 'feed', collection: 'post', data: { text } });

describe('records: validation', () => {
  it('creates a post and returns a DTO with the author', async () => {
    const h = await makeHabitat();
    const r = await createRecord(h.members[0]!, post('  hello  '));
    expect(r).toMatchObject({ module: 'feed', collection: 'post', data: { text: 'hello' }, pinned: false, commentCount: 0 });
    expect(r.author?.id).toBe(h.members[0]!.userId);
  });

  it('422 with field errors for bad data, unknown keys stripped', async () => {
    const h = await makeHabitat();
    await expect(createRecord(h.members[0]!, post('x'.repeat(5001)))).rejects.toMatchObject({
      status: 422,
      fields: { text: expect.any(Array) },
    });
    const r = await createRecord(h.members[0]!, { module: 'feed', collection: 'post', data: { text: 'a', evil: '<script>' } });
    expect(r.data).not.toHaveProperty('evil');
  });

  it('a post needs text or a photo', async () => {
    const h = await makeHabitat();
    await expect(createRecord(h.members[0]!, post('   '))).rejects.toMatchObject({ status: 422 });
  });

  it('404 for a module that is not installed, an unknown module or collection', async () => {
    const h = await makeHabitat();
    const poll = { module: 'polls', collection: 'poll', data: { question: 'Q', options: ['a', 'b'] } };
    await expect(createRecord(h.members[0]!, poll)).rejects.toMatchObject({ status: 404, code: 'module_not_installed' });
    await expect(createRecord(h.members[0]!, { module: 'nope', collection: 'x', data: {} })).rejects.toMatchObject({ status: 404 });
    await expect(createRecord(h.members[0]!, { module: 'feed', collection: 'nope', data: {} })).rejects.toMatchObject({ status: 404 });
  });

  it('parents: required where declared, forbidden elsewhere, and must be the right kind', async () => {
    const h = await makeHabitat();
    const m = h.members[0]!;
    await expect(
      createRecord(m, { module: 'events', collection: 'rsvp', data: { status: 'going' } }),
    ).rejects.toMatchObject({ status: 422 });
    const p = await createRecord(m, post('hi'));
    await expect(
      createRecord(m, { module: 'events', collection: 'rsvp', parentId: p.id, data: { status: 'going' } }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(createRecord(m, { ...post('x'), parentId: p.id })).rejects.toMatchObject({ status: 422 });
  });

  it('media must be ready and belong to this habitat', async () => {
    const a = await makeHabitat();
    const b = await makeHabitat();
    const mine = await makeMedia(a.id, a.members[0]!.userId);
    const theirs = await makeMedia(b.id, b.members[0]!.userId);
    const pending = await makeMedia(a.id, a.members[0]!.userId, 'pending');
    const ok = await createRecord(a.members[0]!, { module: 'feed', collection: 'post', data: { mediaIds: [mine] } });
    expect(ok.data.mediaIds).toEqual([mine]);
    for (const id of [theirs, pending]) {
      await expect(
        createRecord(a.members[0]!, { module: 'feed', collection: 'post', data: { text: 'x', mediaIds: [id] } }),
      ).rejects.toMatchObject({ status: 422, fields: { mediaIds: expect.any(Array) } });
    }
  });

  it('member references must be current members of this habitat', async () => {
    const a = await makeHabitat({ members: 2, extraModules: ['split-costs'] });
    const b = await makeHabitat();
    const base = { module: 'split-costs', collection: 'expense' };
    const data = (paidBy: string, among: string[]) => ({
      description: 'Dinner',
      amount: { amountMinor: 3000, currency: 'GBP' },
      paidBy,
      splitAmong: among,
    });
    const ids = a.members.map((m) => m.userId);
    await createRecord(a.members[0]!, { ...base, data: data(ids[0]!, ids) });
    await expect(
      createRecord(a.members[0]!, { ...base, data: data(b.members[0]!.userId, ids) }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(createRecord(a.members[0]!, { ...base, data: data(ids[0]!, []) })).rejects.toMatchObject({ status: 422 });
  });
});

describe('records: permissions', () => {
  it('authors edit their own; others cannot; admins can delete but not edit', async () => {
    const h = await makeHabitat({ members: 3 });
    await setRole(h, 1, 'admin');
    const r = await createRecord(h.members[2]!, post('mine'));
    await expect(updateRecord(h.members[0]!, r.id, { text: 'hijack' })).rejects.toMatchObject({ status: 403 });
    await expect(updateRecord(h.members[1]!, r.id, { text: 'hijack' })).rejects.toMatchObject({ status: 403 });
    const upd = await updateRecord(h.members[2]!, r.id, { text: 'edited' });
    expect(upd.data.text).toBe('edited');
    await deleteRecord(h.members[1]!, r.id);
    await expect(getRecord(h.members[2]!, r.id)).rejects.toMatchObject({ status: 404 });
  });

  it('a plain member cannot delete someone else’s record', async () => {
    const h = await makeHabitat({ members: 3 });
    const r = await createRecord(h.members[1]!, post('x'));
    await expect(deleteRecord(h.members[2]!, r.id)).rejects.toMatchObject({ status: 403 });
  });

  it('deleting a parent deletes its children', async () => {
    const h = await makeHabitat({ members: 2 });
    const ev = await createRecord(h.members[0]!, {
      module: 'events',
      collection: 'event',
      data: { title: 'Pub', startsAt: '2026-12-01T19:00:00Z' },
    });
    const rsvp = await createRecord(h.members[1]!, {
      module: 'events',
      collection: 'rsvp',
      parentId: ev.id,
      data: { status: 'going' },
    });
    await deleteRecord(h.members[0]!, ev.id);
    await expect(getRecord(h.members[1]!, rsvp.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('records: uniqueness', () => {
  it('per-member-per-parent: answering again updates instead of duplicating', async () => {
    const h = await makeHabitat({ members: 2 });
    const ev = await createRecord(h.members[0]!, {
      module: 'events',
      collection: 'event',
      data: { title: 'Pub', startsAt: '2026-12-01T19:00:00Z' },
    });
    const body = (status: string) => ({ module: 'events', collection: 'rsvp', parentId: ev.id, data: { status } });
    const first = await createRecord(h.members[1]!, body('maybe'));
    const second = await createRecord(h.members[1]!, body('going'));
    expect(second.id).toBe(first.id);
    expect(second.data.status).toBe('going');
    const all = await queryRecords(h.members[0]!, { module: 'events', collection: 'rsvp', parentId: ev.id });
    expect(all.items).toHaveLength(1);
    // only the first answer notifies the organiser
    const n = await getDb().select().from(s.notification).where(eq(s.notification.type, 'events.rsvp'));
    expect(n).toHaveLength(1);
  });

  it('per-member: one birthday each', async () => {
    const h = await makeHabitat({ members: 2, extraModules: ['birthdays'] });
    const b = (day: number) => ({ module: 'birthdays', collection: 'birthday', data: { month: 3, day } });
    const a1 = await createRecord(h.members[0]!, b(3));
    const a2 = await createRecord(h.members[0]!, b(4));
    await createRecord(h.members[1]!, b(5));
    expect(a2.id).toBe(a1.id);
    expect((await queryRecords(h.members[0]!, { module: 'birthdays', collection: 'birthday' })).items).toHaveLength(2);
  });
});

describe('records: wishlist claims are hidden from the wish owner', () => {
  it('hides claims in get and query, but others can see them', async () => {
    const h = await makeHabitat({ members: 3, extraModules: ['wishlist'] });
    const [owner, friend, other] = h.members;
    const wish = await createRecord(owner!, { module: 'wishlist', collection: 'wish', data: { title: 'Kettle' } });
    const claim = await createRecord(friend!, { module: 'wishlist', collection: 'claim', parentId: wish.id, data: {} });
    const q = { module: 'wishlist', collection: 'claim', parentId: wish.id };
    expect((await queryRecords(owner!, q)).items).toHaveLength(0);
    expect((await queryRecords(other!, q)).items).toHaveLength(1);
    await expect(getRecord(owner!, claim.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteRecord(owner!, claim.id)).rejects.toMatchObject({ status: 404 });
    // a second claim on the same wish is a conflict, not an overwrite
    await expect(
      createRecord(other!, { module: 'wishlist', collection: 'claim', parentId: wish.id, data: {} }),
    ).rejects.toMatchObject({ status: 409, code: 'already_exists' });
  });
});

describe('records: querying', () => {
  it('filters, orders and paginates by keyset', async () => {
    const h = await makeHabitat({ extraModules: ['recommendations'] });
    const m = h.members[0]!;
    for (let i = 1; i <= 5; i++) {
      await createRecord(m, {
        module: 'recommendations',
        collection: 'rec',
        data: { kind: i % 2 ? 'film' : 'book', title: `T${i}`, rating: i },
      });
    }
    const q = { module: 'recommendations', collection: 'rec' };
    const films = await queryRecords(m, { ...q, where: { kind: { eq: 'film' } } });
    expect(films.items.map((r) => r.data.title).sort()).toEqual(['T1', 'T3', 'T5']);
    const top = await queryRecords(m, { ...q, order: 'rating:desc', limit: 2 });
    expect(top.items.map((r) => r.data.rating)).toEqual([5, 4]);
    expect(top.nextCursor).toBeTruthy();
    const next = await queryRecords(m, { ...q, order: 'rating:desc', limit: 2, cursor: top.nextCursor! });
    expect(next.items.map((r) => r.data.rating)).toEqual([3, 2]);
    const last = await queryRecords(m, { ...q, order: 'rating:desc', limit: 2, cursor: next.nextCursor! });
    expect(last.items.map((r) => r.data.rating)).toEqual([1]);
    expect(last.nextCursor).toBeNull();
    const range = await queryRecords(m, { ...q, where: { rating: { gte: '2', lt: '5' } }, order: 'rating:asc' });
    expect(range.items.map((r) => r.data.rating)).toEqual([2, 3, 4]);
  });

  it('paginates the default order (newest first) without gaps or repeats', async () => {
    const h = await makeHabitat();
    const m = h.members[0]!;
    const t = Date.parse('2026-05-01T00:00:00Z');
    for (let i = 0; i < 7; i++) await createRecord(m, post(`p${i}`), new Date(t + i * 1000));
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await queryRecords(m, { module: 'feed', collection: 'post', limit: 3, cursor });
      seen.push(...page.items.map((r) => r.data.text as string));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(['p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
  });

  it('rejects undeclared fields with 400', async () => {
    const h = await makeHabitat();
    await expect(
      queryRecords(h.members[0]!, { module: 'feed', collection: 'post', where: { secret: { eq: 'x' } } }),
    ).rejects.toMatchObject({ status: 400, code: 'bad_query' });
  });

  it('an injection-shaped value is just a value', async () => {
    const h = await makeHabitat();
    const m = h.members[0]!;
    await createRecord(m, post("x'); DROP TABLE record; --"));
    const r = await queryRecords(m, {
      module: 'feed',
      collection: 'post',
      where: { text: { eq: "x'); DROP TABLE record; --" } },
    });
    expect(r.items).toHaveLength(1);
  });
});

describe('records: limits and notifications', () => {
  it('rate limits writes to 60 per member per minute', async () => {
    const h = await makeHabitat();
    const now = new Date('2026-06-01T12:00:10Z');
    for (let i = 0; i < 60; i++) await createRecord(h.members[0]!, post(`p${i}`), now);
    await expect(createRecord(h.members[0]!, post('one too many'), now)).rejects.toMatchObject({ status: 429 });
    await createRecord(h.members[0]!, post('next minute'), new Date('2026-06-01T12:01:10Z'));
  });

  it('@mentions notify only the person mentioned, never the author', async () => {
    const h = await makeHabitat({ members: 3 });
    const names = await getDb().select().from(s.user);
    const target = names.find((u) => u.id === h.members[1]!.userId)!;
    await createRecord(h.members[0]!, post(`hey @${target.name} and @${names.find((u) => u.id === h.members[0]!.userId)!.name}`));
    const n = await getDb().select().from(s.notification);
    expect(n.map((x) => x.userId)).toEqual([target.id]);
    expect(n[0]!.payload).toMatchObject({ text: expect.stringContaining('mentioned you') });
  });

  it('a new event notifies everyone else', async () => {
    const h = await makeHabitat({ members: 3 });
    await createRecord(h.members[0]!, {
      module: 'events',
      collection: 'event',
      data: { title: 'Pub', startsAt: '2026-12-01T19:00:00Z' },
    });
    const n = await getDb().select().from(s.notification).where(eq(s.notification.type, 'events.event'));
    expect(n.map((x) => x.userId).sort()).toEqual([h.members[1]!.userId, h.members[2]!.userId].sort());
    expect(n[0]!.payload).toMatchObject({ text: expect.stringContaining('“Pub”') });
  });

  it('writes nothing if a notification step fails (same transaction)', async () => {
    const h = await makeHabitat({ members: 2 });
    await expect(
      createRecord(h.members[0]!, { module: 'events', collection: 'event', data: { title: '', startsAt: 'nope' } }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await getDb().select().from(s.notification)).toHaveLength(0);
  });
});
