import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { participant, project } from '@/db/schema';
import { acceptInvite, createInvite, inviteInfo, regenerateInvite } from '@/lib/invites';
import { requireCreator, requireParticipant } from '@/lib/permissions';
import { createProject, listProjects, updateContext } from '@/lib/projects';
import { NotFound } from '@/lib/errors';
import { freshDb, makeUser } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

async function newProject(userId: string, extra: object = {}) {
  return createProject(db, userId, { roomType: 'living_room', displayName: 'Rich', ...extra });
}

describe('creating a project', () => {
  it('builds frozen decks and a creator participant', async () => {
    const u = await makeUser(db);
    const created = await newProject(u, { name: 'Our lounge', budgetBand: 'mid' });
    const [p] = await db.select().from(project).where(eq(project.id, created.projectId));
    expect(p.macroDeck).toHaveLength(12);
    expect(p.microDeck).toHaveLength(18);
    expect(p.reserveMacro).toHaveLength(2);
    expect(p.reserveMicro).toHaveLength(2);
    expect(p.budgetBand).toBe('mid');
    const people = await db.select().from(participant).where(eq(participant.projectId, p.id));
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ role: 'creator', userId: u, hostUserId: u, vetoesLeft: 3 });
    expect(created.inviteToken.length).toBeGreaterThan(20);
  });

  it('applies room context to the decks (R14)', async () => {
    const u = await makeUser(db);
    const created = await newProject(u, {
      context: { keeping: [{ category: 'sofa', colour: 'grey' }] },
    });
    const [p] = await db.select().from(project).where(eq(project.id, created.projectId));
    expect(p.context.keeping).toEqual([{ category: 'sofa', colour: 'grey' }]);
    expect(p.microDeck).toHaveLength(18);
  });

  it('rejects a room with no catalogue', async () => {
    const u = await makeUser(db);
    await expect(newProject(u, { roomType: 'bedroom' })).rejects.toThrow(/enough cards/i);
  });

  it('lists my projects only', async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    await newProject(a);
    expect(await listProjects(db, a)).toHaveLength(1);
    expect(await listProjects(db, b)).toHaveLength(0);
  });

  it('locks the room context once the board is out', async () => {
    const u = await makeUser(db);
    const { projectId } = await newProject(u);
    await updateContext(db, projectId, { household: { dog: true, cat: false, youngKids: false } });
    await db.update(project).set({ revealedAt: new Date() }).where(eq(project.id, projectId));
    await expect(updateContext(db, projectId, { hidePracticalRisks: true })).rejects.toThrow(
      /locked/i,
    );
  });
});

describe('access control', () => {
  it('gives non-members a 404 for every access check', async () => {
    const owner = await makeUser(db);
    const stranger = await makeUser(db);
    const { projectId } = await newProject(owner);
    await expect(requireParticipant(db, projectId, stranger)).rejects.toBeInstanceOf(NotFound);
    await expect(requireCreator(db, projectId, stranger)).rejects.toBeInstanceOf(NotFound);
    await expect(requireParticipant(db, 'does-not-exist', owner)).rejects.toBeInstanceOf(NotFound);
  });

  it('only lets the creator do creator things', async () => {
    const owner = await makeUser(db);
    const partner = await makeUser(db);
    const { projectId, inviteToken } = await newProject(owner);
    await acceptInvite(db, inviteToken, partner, 'Sam');
    await expect(requireCreator(db, projectId, partner)).rejects.toThrow(/started this/i);
    await expect(requireCreator(db, projectId, owner)).resolves.toBeTruthy();
  });
});

describe('invites', () => {
  it('lets a guest join with just a name, and joining twice is idempotent', async () => {
    const owner = await makeUser(db);
    const guest = await makeUser(db);
    const { projectId, inviteToken } = await newProject(owner);
    const first = await acceptInvite(db, inviteToken, guest, '  Sam  ');
    const again = await acceptInvite(db, inviteToken, guest, 'Sam');
    expect(again.participantId).toBe(first.participantId);
    const people = await db.select().from(participant).where(eq(participant.projectId, projectId));
    expect(people.map((p) => p.displayName).sort()).toEqual(['Rich', 'Sam']);
  });

  it('describes the invite to someone who has not signed in', async () => {
    const owner = await makeUser(db);
    const { inviteToken } = await newProject(owner);
    expect(await inviteInfo(db, inviteToken)).toMatchObject({
      roomType: 'living_room',
      creatorName: 'Rich',
      full: false,
    });
    expect(await inviteInfo(db, 'nonsense')).toBeNull();
  });

  it('stops working once replaced or revoked', async () => {
    const owner = await makeUser(db);
    const { projectId, inviteToken } = await newProject(owner);
    const fresh = await regenerateInvite(db, projectId);
    expect(await inviteInfo(db, inviteToken)).toBeNull();
    expect(await inviteInfo(db, fresh)).not.toBeNull();
  });

  it('stops working after 14 days', async () => {
    const owner = await makeUser(db);
    const { projectId } = await newProject(owner);
    const token = await createInvite(db, projectId);
    expect(await inviteInfo(db, token)).not.toBeNull();
    const { projectInvite } = await import('@/db/schema');
    await db.update(projectInvite).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await inviteInfo(db, token)).toBeNull();
    await expect(acceptInvite(db, token, await makeUser(db), 'Late')).rejects.toBeInstanceOf(
      NotFound,
    );
  });

  it('caps a room at four people', async () => {
    const owner = await makeUser(db);
    const { inviteToken } = await newProject(owner);
    for (const name of ['B', 'C', 'D'])
      await acceptInvite(db, inviteToken, await makeUser(db), name);
    expect((await inviteInfo(db, inviteToken))!.full).toBe(true);
    await expect(acceptInvite(db, inviteToken, await makeUser(db), 'E')).rejects.toThrow(
      /4 people/,
    );
  });

  it('marks people who join after the reveal', async () => {
    const owner = await makeUser(db);
    const { projectId, inviteToken } = await newProject(owner);
    await db.update(project).set({ revealedAt: new Date() }).where(eq(project.id, projectId));
    const { participantId } = await acceptInvite(db, inviteToken, await makeUser(db), 'Late');
    const [p] = await db.select().from(participant).where(eq(participant.id, participantId));
    expect(p.joinedAfterReveal).toBe(true);
  });
});
