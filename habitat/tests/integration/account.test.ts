import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { deleteAccount, exportMyData } from '@/lib/account';
import { addComment } from '@/lib/interactions';
import { createRecord, getRecord } from '@/lib/records';
import { createReport, listReports, resolveReport } from '@/lib/reports';
import { transferOwnership } from '@/lib/habitats';
import { makeHabitat } from './factories';

const post = (text: string) => ({ module: 'feed', collection: 'post', data: { text } });

describe('account', () => {
  it('exports what you posted', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await createRecord(h.members[1]!, post('mine'));
    await addComment(h.members[1]!, p.id, { body: 'also mine' });
    const data = await exportMyData(h.members[1]!.userId);
    expect(data.account?.id).toBe(h.members[1]!.userId);
    expect(data.records.map((r) => r.data)).toEqual([{ text: 'mine', mediaIds: [] }]);
    expect(data.comments.map((c) => c.body)).toEqual(['also mine']);
    expect(data.habitats).toHaveLength(1);
  });

  it('deleting an account keeps group history as "Former member"', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await createRecord(h.members[1]!, post('hello'));
    await deleteAccount(h.members[1]!.userId);
    expect(await getDb().select().from(s.user).where(eq(s.user.id, h.members[1]!.userId))).toHaveLength(0);
    const seen = await getRecord(h.members[0]!, p.id);
    expect(seen.author).toBeNull();
  });

  it('deleteContent removes the content too', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await createRecord(h.members[1]!, post('hello'));
    await deleteAccount(h.members[1]!.userId, { deleteContent: true });
    await expect(getRecord(h.members[0]!, p.id)).rejects.toMatchObject({ status: 404 });
  });

  it('an owner with company must hand over first; a solo owner’s habitat is deleted', async () => {
    const h = await makeHabitat({ members: 2 });
    await expect(deleteAccount(h.members[0]!.userId)).rejects.toMatchObject({ status: 409, code: 'owns_habitat' });
    await transferOwnership(h.members[0]!, h.members[1]!.userId);
    await deleteAccount(h.members[0]!.userId);

    const solo = await makeHabitat();
    await deleteAccount(solo.members[0]!.userId);
    const [row] = await getDb().select().from(s.habitat).where(eq(s.habitat.id, solo.id));
    expect(row!.deletedAt).not.toBeNull();
  });
});

describe('reports', () => {
  it('members report; only admins read and resolve; targets must be in this habitat', async () => {
    const h = await makeHabitat({ members: 3 });
    const other = await makeHabitat();
    const p = await createRecord(h.members[1]!, post('rude'));
    await createReport(h.members[2]!, { targetType: 'record', targetId: p.id, reason: 'This is rude' });
    await createReport(h.members[2]!, { targetType: 'member', targetId: h.members[1]!.userId, reason: 'Harassing' });
    await expect(
      createReport(h.members[2]!, { targetType: 'record', targetId: 'nope', reason: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    const foreign = await createRecord(other.members[0]!, post('elsewhere'));
    await expect(
      createReport(h.members[2]!, { targetType: 'record', targetId: foreign.id, reason: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(createReport(h.members[2]!, { targetType: 'record', targetId: p.id, reason: '  ' })).rejects.toMatchObject({ status: 422 });

    await expect(listReports(h.members[2]!)).rejects.toMatchObject({ status: 403 });
    const reports = await listReports(h.members[0]!);
    expect(reports).toHaveLength(2);
    await resolveReport(h.members[0]!, reports[0]!.id);
    await expect(resolveReport(other.members[0]!, reports[1]!.id)).rejects.toMatchObject({ status: 404 });
  });
});
