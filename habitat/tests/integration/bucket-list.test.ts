import { describe, expect, it } from 'vitest';
import { addComment, addReaction } from '@/lib/interactions';
import { propose } from '@/lib/proposals';
import { createRecord, queryRecords, updateRecord } from '@/lib/records';
import { getTimeline } from '@/lib/timeline';
import { makeHabitat } from './factories';

describe('a declarative module behaves like any other', () => {
  it('installs by vote, lets any member tick items off, and gets comments, reactions and the timeline', async () => {
    const h = await makeHabitat({ members: 2 });
    const [a, b] = h.members;
    const p = await propose(a!, { kind: 'install', moduleId: 'bucket-list' });
    expect(p.status).toBe('open');
    await (await import('@/lib/proposals')).vote(b!, p.id, 'yes');

    const idea = await createRecord(a!, {
      module: 'bucket-list',
      collection: 'idea',
      data: { title: 'Go skydiving' },
    });
    expect(idea.data).toMatchObject({ title: 'Go skydiving', done: false });

    // someone else ticks it off (update: 'member')
    const done = await updateRecord(b!, idea.id, { done: true });
    expect(done.data.done).toBe(true);

    const open = await queryRecords(a!, {
      module: 'bucket-list',
      collection: 'idea',
      where: { done: { eq: 'false' } },
    });
    expect(open.items).toHaveLength(0);
    const finished = await queryRecords(a!, {
      module: 'bucket-list',
      collection: 'idea',
      where: { done: { eq: 'true' } },
    });
    expect(finished.items).toHaveLength(1);

    await addReaction(b!, idea.id, '🎉');
    await addComment(b!, idea.id, { body: 'Booked it!' });
    const tl = await getTimeline(a!);
    expect(tl.items[0]).toMatchObject({
      module: 'bucket-list',
      commentCount: 1,
      reactionCounts: { '🎉': 1 },
    });
  });
});
