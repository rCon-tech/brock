import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { participant, project } from '@/db/schema';
import { getBoard } from '@/lib/board';
import { NotFound } from '@/lib/errors';
import { addDeviceParticipant } from '@/lib/participants';
import { requireParticipant } from '@/lib/permissions';
import { createProject } from '@/lib/projects';
import { afterFinished, markReady, maybeReveal } from '@/lib/reveal';
import { getDeckState, recordSwipes } from '@/lib/swipes';
import { INDUSTRIAL, MINIMAL, freshDb, makeUser, styleCard, swipeDeck } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

describe('passing one phone around (R17)', () => {
  async function onePhone() {
    const host = await makeUser(db, 'Host');
    const created = await createProject(db, host, {
      roomType: 'living_room',
      displayName: 'Rich',
      mode: 'together_one_device',
    });
    const samId = await addDeviceParticipant(db, host, created.projectId, 'Sam');
    return { host, ...created, samId };
  }

  it('lets one session control several people, one at a time', async () => {
    const t = await onePhone();
    await expect(requireParticipant(db, t.projectId, t.host)).rejects.toThrow(/choose who/i);
    expect((await requireParticipant(db, t.projectId, t.host, t.samId)).me.displayName).toBe('Sam');
    expect(
      (await requireParticipant(db, t.projectId, t.host, t.participantId)).me.displayName,
    ).toBe('Rich');
    const stranger = await makeUser(db);
    await expect(requireParticipant(db, t.projectId, stranger, t.samId)).rejects.toBeInstanceOf(
      NotFound,
    );
  });

  it('keeps each person’s swipes separate', async () => {
    const t = await onePhone();
    const rich = await getDeckState(db, t.participantId);
    await recordSwipes(
      db,
      t.participantId,
      rich.remainingMacro.slice(0, 2).map((id, i) => ({
        clientId: `one-${i}-aaaaaaa`,
        itemId: id,
        round: 'macro' as const,
        value: 1 as const,
      })),
    );
    expect((await getDeckState(db, t.samId)).remainingMacro).toHaveLength(12);
    expect((await getDeckState(db, t.participantId)).remainingMacro).toHaveLength(10);
  });

  it('is ready automatically once everyone has finished, and reveals', async () => {
    const t = await onePhone();
    await swipeDeck(db, t.participantId, styleCard(...INDUSTRIAL));
    expect(await afterFinished(db, t.projectId)).toEqual({ revealed: false });
    await swipeDeck(db, t.samId, styleCard(...MINIMAL));
    const out = await afterFinished(db, t.projectId);
    expect(out).toMatchObject({ revealed: true });
    const board = (await getBoard(db, t.projectId, t.participantId))!;
    expect(board.participants.map((p) => p.name).sort()).toEqual(['Rich', 'Sam']);
    expect((await getBoard(db, t.projectId, t.samId))!.viewer.name).toBe('Sam');
  });

  it('refuses extra people in other modes and beyond four', async () => {
    const host = await makeUser(db);
    const remote = await createProject(db, host, { roomType: 'living_room', displayName: 'A' });
    await expect(addDeviceParticipant(db, host, remote.projectId, 'B')).rejects.toThrow(
      /sharing one phone/i,
    );
    const t = await onePhone();
    await addDeviceParticipant(db, t.host, t.projectId, 'C');
    await addDeviceParticipant(db, t.host, t.projectId, 'D');
    await expect(addDeviceParticipant(db, t.host, t.projectId, 'E')).rejects.toThrow(/4 people/);
  });
});

describe('two phones, live reveal (R18)', () => {
  it('reveals for both only after both have tapped Ready', async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const created = await createProject(db, a, {
      roomType: 'living_room',
      displayName: 'A',
      mode: 'together_devices',
    });
    const { acceptInvite } = await import('@/lib/invites');
    const partner = await acceptInvite(db, created.inviteToken, b, 'B');
    await swipeDeck(db, created.participantId, styleCard(...INDUSTRIAL));
    await swipeDeck(db, partner.participantId, styleCard(...MINIMAL));
    await markReady(db, created.participantId);
    expect((await maybeReveal(db, created.projectId)).revealed).toBe(false);
    const [p] = await db.select().from(project).where(eq(project.id, created.projectId));
    expect(p.revealedAt).toBeNull();
    await markReady(db, partner.participantId);
    expect((await maybeReveal(db, created.projectId)).revealed).toBe(true);
    const people = await db
      .select()
      .from(participant)
      .where(eq(participant.projectId, created.projectId));
    expect(people.every((x) => x.readyAt)).toBe(true);
  });
});
