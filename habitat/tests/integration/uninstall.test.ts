import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { listActive, purgeRemoved, reorder } from '@/lib/installed-modules';
import { propose } from '@/lib/proposals';
import { createRecord, getRecord, queryRecords } from '@/lib/records';
import { deleteHabitat } from '@/lib/habitats';
import { makeHabitat } from './factories';

const DAY = 86400_000;

describe('uninstalling a module (H9)', () => {
  it('hides data, then reinstalling brings it all back', async () => {
    const h = await makeHabitat({ extraModules: ['polls'] });
    const m = h.members[0]!;
    const poll = await createRecord(m, {
      module: 'polls',
      collection: 'poll',
      data: { question: 'Q?', options: ['a', 'b'] },
    });

    expect((await propose(m, { kind: 'uninstall', moduleId: 'polls' })).status).toBe('passed');
    await expect(getRecord(m, poll.id)).rejects.toMatchObject({ status: 404 });
    await expect(queryRecords(m, { module: 'polls', collection: 'poll' })).rejects.toMatchObject({
      code: 'module_not_installed',
    });
    await expect(
      createRecord(m, {
        module: 'polls',
        collection: 'poll',
        data: { question: 'Q', options: ['a', 'b'] },
      }),
    ).rejects.toMatchObject({ code: 'module_not_installed' });

    expect((await propose(m, { kind: 'install', moduleId: 'polls' })).status).toBe('passed');
    expect((await getRecord(m, poll.id)).data.question).toBe('Q?');
  });

  it('the purge job deletes data only after 30 days', async () => {
    const h = await makeHabitat({ extraModules: ['polls'] });
    const m = h.members[0]!;
    await createRecord(m, {
      module: 'polls',
      collection: 'poll',
      data: { question: 'Q?', options: ['a', 'b'] },
    });
    const removedAt = new Date('2026-01-01T00:00:00Z');
    await getDb()
      .update(s.installedModule)
      .set({ removedAt })
      .where(eq(s.installedModule.moduleId, 'polls'));

    expect(await purgeRemoved(new Date(removedAt.getTime() + 29 * DAY))).toEqual({
      modules: 0,
      habitats: 0,
    });
    expect(await getDb().select().from(s.record)).toHaveLength(1);
    expect(await purgeRemoved(new Date(removedAt.getTime() + 31 * DAY))).toEqual({
      modules: 1,
      habitats: 0,
    });
    expect(await getDb().select().from(s.record)).toHaveLength(0);
  });

  it('purges habitats deleted over 30 days ago', async () => {
    const h = await makeHabitat();
    const at = new Date('2026-01-01T00:00:00Z');
    await deleteHabitat(h.members[0]!, at);
    expect((await purgeRemoved(new Date(at.getTime() + 10 * DAY))).habitats).toBe(0);
    expect((await purgeRemoved(new Date(at.getTime() + 31 * DAY))).habitats).toBe(1);
    expect(await getDb().select().from(s.habitat)).toHaveLength(0);
  });

  it('reorders modules; admins only; must list every module once', async () => {
    const h = await makeHabitat({ members: 2 });
    await reorder(h.members[0]!, ['chat', 'events', 'photos', 'feed']);
    expect((await listActive(getDb(), h.id)).map((a) => a.manifest.id)).toEqual([
      'chat',
      'events',
      'photos',
      'feed',
    ]);
    await expect(
      reorder(h.members[1]!, ['feed', 'chat', 'events', 'photos']),
    ).rejects.toMatchObject({ status: 403 });
    await expect(reorder(h.members[0]!, ['chat'])).rejects.toMatchObject({ status: 422 });
    await expect(
      reorder(h.members[0]!, ['chat', 'chat', 'events', 'photos']),
    ).rejects.toMatchObject({ status: 422 });
  });
});
