import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import {
  addComment,
  addReaction,
  deleteComment,
  editComment,
  listComments,
  removeReaction,
  setPinned,
} from '@/lib/interactions';
import { createRecord, getRecord } from '@/lib/records';
import { getTimeline } from '@/lib/timeline';
import { makeHabitat, setRole } from './factories';

const post = (text: string) => ({ module: 'feed', collection: 'post', data: { text } });

describe('comments', () => {
  it('adds, threads one level, edits and deletes', async () => {
    const h = await makeHabitat({ members: 3 });
    const [a, b, c] = h.members;
    const p = await createRecord(a!, post('hi'));
    const top = await addComment(b!, p.id, { body: 'first' });
    const reply = await addComment(c!, p.id, { body: 'reply', parentCommentId: top.id });
    expect(reply.parentCommentId).toBe(top.id);
    await expect(
      addComment(a!, p.id, { body: 'too deep', parentCommentId: reply.id }),
    ).rejects.toMatchObject({ status: 422 });

    const thread = await listComments(a!, p.id);
    expect(thread).toHaveLength(1);
    expect(thread[0]!.replies.map((r) => r.body)).toEqual(['reply']);
    expect((await getRecord(a!, p.id)).commentCount).toBe(2);

    await editComment(b!, top.id, 'first (edited)');
    expect((await listComments(a!, p.id))[0]).toMatchObject({
      body: 'first (edited)',
      editedAt: expect.any(String),
    });
    await expect(editComment(c!, top.id, 'nope')).rejects.toMatchObject({ status: 403 });

    await deleteComment(b!, top.id);
    expect(await listComments(a!, p.id)).toEqual([]);
    expect((await getRecord(a!, p.id)).commentCount).toBe(0);
  });

  it('admins can delete anyone’s comment, members cannot', async () => {
    const h = await makeHabitat({ members: 3 });
    await setRole(h, 1, 'admin');
    const p = await createRecord(h.members[0]!, post('hi'));
    const c1 = await addComment(h.members[2]!, p.id, { body: 'rude' });
    await expect(deleteComment(h.members[0]!, c1.id)).resolves.toBeUndefined(); // owner is an admin too
    const c2 = await addComment(h.members[0]!, p.id, { body: 'x' });
    await expect(deleteComment(h.members[2]!, c2.id)).rejects.toMatchObject({ status: 403 });
  });

  it('validates the body', async () => {
    const h = await makeHabitat();
    const p = await createRecord(h.members[0]!, post('hi'));
    await expect(addComment(h.members[0]!, p.id, { body: '   ' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(addComment(h.members[0]!, p.id, { body: 'x'.repeat(2001) })).rejects.toMatchObject(
      { status: 422 },
    );
  });

  it('notifies once per person: mention beats reply beats comment, never the author', async () => {
    const h = await makeHabitat({ members: 3 });
    const [a, b, c] = h.members;
    const users = await getDb().select().from(s.user);
    const nameOf = (id: string) => users.find((u) => u.id === id)!.name;
    const p = await createRecord(a!, post('hi'));
    const top = await addComment(b!, p.id, { body: 'nice' });
    await getDb().delete(s.notification);
    await addComment(c!, p.id, { body: `@${nameOf(b!.userId)} thanks`, parentCommentId: top.id });
    const n = await getDb().select().from(s.notification);
    const byUser = Object.fromEntries(n.map((x) => [x.userId, x.type]));
    expect(byUser).toEqual({ [b!.userId]: 'comment.mention', [a!.userId]: 'comment.new' });
  });
});

describe('reactions', () => {
  it('one of each emoji per person, removable, validated', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await createRecord(h.members[0]!, post('hi'));
    await addReaction(h.members[1]!, p.id, '❤️');
    await addReaction(h.members[1]!, p.id, '❤️');
    await addReaction(h.members[1]!, p.id, '🎉');
    await addReaction(h.members[0]!, p.id, '❤️');
    const seen = await getRecord(h.members[1]!, p.id);
    expect(seen.reactionCounts).toEqual({ '❤️': 2, '🎉': 1 });
    expect(seen.myReactions.sort()).toEqual(['❤️', '🎉'].sort());
    await removeReaction(h.members[1]!, p.id, '❤️');
    expect((await getRecord(h.members[1]!, p.id)).reactionCounts).toEqual({ '❤️': 1, '🎉': 1 });
    await expect(addReaction(h.members[1]!, p.id, '💩')).rejects.toMatchObject({ status: 422 });
  });
});

describe('timeline and pins', () => {
  it('merges timeline collections newest first, pinned apart and excluded from the pages', async () => {
    const h = await makeHabitat({ members: 2, extraModules: ['polls'] });
    const [a, b] = h.members;
    const t = Date.parse('2026-05-01T00:00:00Z');
    const p1 = await createRecord(a!, post('one'), new Date(t));
    await createRecord(b!, post('two'), new Date(t + 1000));
    await createRecord(
      a!,
      { module: 'polls', collection: 'poll', data: { question: 'Pizza?', options: ['yes', 'no'] } },
      new Date(t + 2000),
    );
    await createRecord(
      a!,
      {
        module: 'events',
        collection: 'event',
        data: { title: 'E', startsAt: '2026-12-01T10:00:00Z' },
      },
      new Date(t + 3000),
    );
    // chat is not a timeline collection
    await createRecord(
      a!,
      { module: 'chat', collection: 'message', data: { text: 'chatter' } },
      new Date(t + 4000),
    );

    const first = await getTimeline(a!, { limit: 3 });
    expect(first.items.map((r) => r.collection)).toEqual(['event', 'poll', 'post']);
    expect(first.nextCursor).toBeTruthy();
    const second = await getTimeline(a!, { limit: 3, cursor: first.nextCursor! });
    expect(second.items.map((r) => r.data.text)).toEqual(['one']);
    expect(second.nextCursor).toBeNull();

    await setPinned(a!, p1.id, true);
    const pinned = await getTimeline(a!, { limit: 10 });
    expect(pinned.pinned.map((r) => r.data.text)).toEqual(['one']);
    expect(pinned.items.map((r) => r.data.text ?? r.data.title ?? r.data.question)).toEqual([
      'E',
      'Pizza?',
      'two',
    ]);
    expect(pinned.pinned[0]!.pinned).toBe(true);
  });

  it('only admins pin, and only timeline records', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await createRecord(h.members[1]!, post('hi'));
    await expect(setPinned(h.members[1]!, p.id, true)).rejects.toMatchObject({ status: 403 });
    const rsvpParent = await createRecord(h.members[0]!, {
      module: 'events',
      collection: 'event',
      data: { title: 'E', startsAt: '2026-12-01T10:00:00Z' },
    });
    const rsvp = await createRecord(h.members[1]!, {
      module: 'events',
      collection: 'rsvp',
      parentId: rsvpParent.id,
      data: { status: 'going' },
    });
    await expect(setPinned(h.members[0]!, rsvp.id, true)).rejects.toMatchObject({ status: 422 });
  });

  it('hides wishlist-style records from the timeline when they are hidden from the viewer', async () => {
    const h = await makeHabitat({ members: 2, extraModules: ['wishlist'] });
    const tl = await getTimeline(h.members[0]!);
    expect(tl.items).toEqual([]);
  });

  it('removed modules vanish from the timeline', async () => {
    const h = await makeHabitat();
    await createRecord(h.members[0]!, post('hi'));
    await getDb()
      .update(s.installedModule)
      .set({ removedAt: new Date() })
      .where(eq(s.installedModule.moduleId, 'feed'));
    expect((await getTimeline(h.members[0]!)).items).toEqual([]);
  });
});
