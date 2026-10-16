import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import {
  createHabitat,
  deleteHabitat,
  listMyHabitats,
  transferOwnership,
  updateHabitat,
} from '@/lib/habitats';
import { changeRole, listMembers, removeMember } from '@/lib/members';
import { listActive } from '@/lib/installed-modules';
import { requireMember } from '@/lib/session';
import { makeHabitat, makeUser } from './factories';

describe('createHabitat', () => {
  it('creates the habitat, an owner and the default modules in one go', async () => {
    const u = await makeUser();
    const h = await createHabitat(u.id, { name: 'The Lads', emoji: '🍻', accent: '#123456' });
    expect(h.slug).toBe('the-lads');
    const ctx = await requireMember(getDb(), h.id, u.id);
    expect(ctx.role).toBe('owner');
    const active = await listActive(getDb(), h.id);
    expect(active.map((a) => a.manifest.id).sort()).toEqual(['chat', 'events', 'feed', 'photos']);
  });

  it('lets the creator untick starting modules', async () => {
    const u = await makeUser();
    const h = await createHabitat(u.id, {
      name: 'Just chat',
      emoji: '💬',
      accent: '#000000',
      modules: ['chat'],
    });
    expect((await listActive(getDb(), h.id)).map((a) => a.manifest.id)).toEqual(['chat']);
  });

  it('refuses library modules at creation (those go through a vote)', async () => {
    const u = await makeUser();
    await expect(
      createHabitat(u.id, { name: 'X Y Z', emoji: '🌿', accent: '#000000', modules: ['polls'] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('gives duplicate names distinct slugs, including under a race', async () => {
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    const made = await Promise.all(
      users.map((u) => createHabitat(u.id, { name: 'Same Name', emoji: '🌿', accent: '#000000' })),
    );
    expect(new Set(made.map((m) => m.slug)).size).toBe(4);
    expect(made.every((m) => m.slug.startsWith('same-name'))).toBe(true);
  });
});

describe('membership', () => {
  it('a non-member and a missing habitat are the same 404', async () => {
    const h = await makeHabitat();
    const stranger = await makeUser();
    await expect(requireMember(getDb(), h.id, stranger.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      requireMember(getDb(), '00000000-0000-0000-0000-000000000000', stranger.id),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(requireMember(getDb(), 'nope', stranger.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lists only my active habitats', async () => {
    const h = await makeHabitat({ members: 2 });
    expect((await listMyHabitats(h.members[1]!.userId)).map((x) => x.id)).toEqual([h.id]);
    await removeMember(h.members[1]!, h.members[1]!.userId);
    expect(await listMyHabitats(h.members[1]!.userId)).toEqual([]);
  });

  it('only the owner can change roles; the owner cannot leave without transferring', async () => {
    const h = await makeHabitat({ members: 3 });
    await changeRole(h.members[0]!, h.members[1]!.userId, 'admin');
    await expect(changeRole(h.members[1]!, h.members[2]!.userId, 'admin')).rejects.toMatchObject({
      status: 403,
    });
    await expect(removeMember(h.members[0]!, h.members[0]!.userId)).rejects.toMatchObject({
      status: 422,
    });
  });

  it('transfers ownership and keeps exactly one owner', async () => {
    const h = await makeHabitat({ members: 2 });
    await transferOwnership(h.members[0]!, h.members[1]!.userId);
    const members = await listMembers(h.id);
    expect(members.filter((m) => m.role === 'owner').map((m) => m.userId)).toEqual([
      h.members[1]!.userId,
    ]);
    expect(members.find((m) => m.userId === h.members[0]!.userId)!.role).toBe('admin');
  });

  it('admins remove members but not other admins', async () => {
    const h = await makeHabitat({ members: 4 });
    await changeRole(h.members[0]!, h.members[1]!.userId, 'admin');
    await changeRole(h.members[0]!, h.members[2]!.userId, 'admin');
    const admin = { ...h.members[1]!, role: 'admin' as const };
    await expect(removeMember(admin, h.members[2]!.userId)).rejects.toMatchObject({ status: 403 });
    await removeMember(admin, h.members[3]!.userId);
    expect(await listMembers(h.id)).toHaveLength(3);
  });

  it('leaving credits content to a former member unless deleted (H13)', async () => {
    const h = await makeHabitat({ members: 2 });
    const [owner, me] = h.members;
    const { createRecord, getRecord } = await import('@/lib/records');
    const post = await createRecord(me!, {
      module: 'feed',
      collection: 'post',
      data: { text: 'hello' },
    });
    await removeMember(me!, me!.userId);
    const seen = await getRecord(owner!, post.id);
    expect(seen.author).toMatchObject({ name: 'Former member' });

    const h2 = await makeHabitat({ members: 2 });
    const post2 = await createRecord(h2.members[1]!, {
      module: 'feed',
      collection: 'post',
      data: { text: 'bye' },
    });
    await removeMember(h2.members[1]!, h2.members[1]!.userId, { deleteContent: true });
    await expect(getRecord(h2.members[0]!, post2.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('settings', () => {
  it('admins update; members cannot; the cap cannot drop below the member count', async () => {
    const h = await makeHabitat({ members: 3 });
    await updateHabitat(h.members[0]!, { name: 'Renamed', accent: '#111111' });
    await expect(updateHabitat(h.members[1]!, { name: 'Nope' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(updateHabitat(h.members[0]!, { memberCap: 2 })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('only the owner deletes, and a deleted habitat is a 404 for everyone', async () => {
    const h = await makeHabitat({ members: 2 });
    await expect(deleteHabitat(h.members[1]!)).rejects.toMatchObject({ status: 403 });
    await deleteHabitat(h.members[0]!);
    await expect(requireMember(getDb(), h.id, h.members[0]!.userId)).rejects.toMatchObject({
      status: 404,
    });
    const [row] = await getDb()
      .select()
      .from(s.habitat)
      .where(and(eq(s.habitat.id, h.id), isNull(s.habitat.deletedAt)));
    expect(row).toBeUndefined();
  });
});
