import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { catalogueItem, participant, project, swipe, user } from '@/db/schema';
import { mergeUserData } from '@/lib/accounts';
import { getBoard } from '@/lib/board';
import { loadEngineItems } from '@/lib/catalogue/load';
import { checkImages, reportImageFailure } from '@/lib/images/check';
import { acceptInvite } from '@/lib/invites';
import { deleteMyData, exportMyData } from '@/lib/my-data';
import { createNextRoom, createProject, listProjects } from '@/lib/projects';
import { allow, enforce } from '@/lib/rate-limit';
import { markReady, maybeReveal } from '@/lib/reveal';
import { nameSynthesis } from '@/lib/synthesis';
import { INDUSTRIAL, MINIMAL, freshDb, makeUser, styleCard, swipeDeck } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

async function revealedCouple() {
  const a = await makeUser(db, 'A');
  const b = await makeUser(db, 'B');
  const created = await createProject(db, a, {
    roomType: 'living_room',
    displayName: 'Rich',
    context: { household: { dog: true } },
    budgetBand: 'mid',
  });
  const partner = await acceptInvite(db, created.inviteToken, b, 'Sam');
  await swipeDeck(db, created.participantId, styleCard(...INDUSTRIAL));
  await swipeDeck(db, partner.participantId, styleCard(...MINIMAL));
  await markReady(db, created.participantId);
  await markReady(db, partner.participantId);
  const out = await maybeReveal(db, created.projectId);
  await nameSynthesis(db, created.projectId, out.version!);
  return { a, b, ...created, partnerId: partner.participantId };
}

describe('rate limits (R36)', () => {
  it('allows up to the limit in a window, then refuses', async () => {
    for (let i = 0; i < 3; i++) expect(await allow(db, 'test:a', 3, 60_000)).toBe(true);
    expect(await allow(db, 'test:a', 3, 60_000)).toBe(false);
    expect(await allow(db, 'test:b', 3, 60_000)).toBe(true); // separate key
  });

  it('starts a fresh window after it elapses', async () => {
    await allow(db, 'test:window', 1, 50);
    expect(await allow(db, 'test:window', 1, 50)).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    expect(await allow(db, 'test:window', 1, 50)).toBe(true);
  });

  it('throws a friendly error when enforced', async () => {
    await enforce(db, 'test:enforce', 1, 60_000);
    await expect(enforce(db, 'test:enforce', 1, 60_000)).rejects.toThrow(/slow down/i);
  });
});

describe('next room (R24)', () => {
  it('carries the people and household over and starts a fresh, unrevealed room', async () => {
    const c = await revealedCouple();
    const next = await createNextRoom(db, c.a, c.projectId, 'living_room');
    const [p] = await db.select().from(project).where(eq(project.id, next.projectId));
    expect(p.previousProjectId).toBe(c.projectId);
    expect(p.context.household.dog).toBe(true);
    expect(p.context.keeping).toEqual([]);
    expect(p.budgetBand).toBe('mid');
    expect(p.revealedAt).toBeNull();
    const people = await db
      .select()
      .from(participant)
      .where(eq(participant.projectId, next.projectId));
    expect(people.map((x) => x.displayName).sort()).toEqual(['Rich', 'Sam']);
    expect((await listProjects(db, c.b)).map((x) => x.id)).toContain(next.projectId);
  });

  it('only the creator can start it', async () => {
    const c = await revealedCouple();
    await expect(createNextRoom(db, c.b, c.projectId, 'living_room')).rejects.toThrow();
  });
});

describe('guest becomes a Google user (R3)', () => {
  it('moves rooms, places and swipes to the real account', async () => {
    const guest = await makeUser(db, 'Guest');
    const google = await makeUser(db, 'Google Rich');
    const created = await createProject(db, guest, {
      roomType: 'living_room',
      displayName: 'Rich',
    });
    await swipeDeck(db, created.participantId, () => true, { finish: false });
    await mergeUserData(db, guest, google);
    const [p] = await db
      .select()
      .from(participant)
      .where(eq(participant.id, created.participantId));
    expect(p).toMatchObject({ userId: google, hostUserId: google });
    const [proj] = await db.select().from(project).where(eq(project.id, created.projectId));
    expect(proj.createdBy).toBe(google);
    expect(
      await db.select().from(swipe).where(eq(swipe.participantId, created.participantId)),
    ).not.toHaveLength(0);
    await db.delete(user).where(eq(user.id, guest)); // Better Auth deletes the guest afterwards
    expect(
      await db.select().from(participant).where(eq(participant.id, created.participantId)),
    ).toHaveLength(1);
  });

  it('keeps the real account’s place when it was already in the room', async () => {
    const owner = await makeUser(db);
    const guest = await makeUser(db);
    const google = await makeUser(db);
    const created = await createProject(db, owner, {
      roomType: 'living_room',
      displayName: 'Owner',
    });
    await acceptInvite(db, created.inviteToken, google, 'Sam (Google)');
    await acceptInvite(db, created.inviteToken, guest, 'Sam (guest)');
    await mergeUserData(db, guest, google);
    const people = await db
      .select()
      .from(participant)
      .where(eq(participant.projectId, created.projectId));
    expect(people.map((p) => p.displayName).sort()).toEqual(['Owner', 'Sam (Google)']);
  });
});

describe('your data (R37)', () => {
  it('exports everything about a person', async () => {
    const c = await revealedCouple();
    const data = await exportMyData(db, c.a);
    expect(data.account?.email).toContain('@');
    expect(data.projects.map((p) => p.id)).toContain(c.projectId);
    expect(data.participants).toHaveLength(1);
    expect(data.swipes.length).toBeGreaterThanOrEqual(30);
    expect(JSON.stringify(data)).not.toContain(c.b); // not the partner's account
  });

  it('deletes a person, keeps the room for the others and rebuilds the board', async () => {
    const c = await revealedCouple();
    await deleteMyData(db, c.a);
    expect(await db.select().from(user).where(eq(user.id, c.a))).toHaveLength(0);
    const [proj] = await db.select().from(project).where(eq(project.id, c.projectId));
    expect(proj.createdBy).toBe(c.b);
    const board = (await getBoard(db, c.projectId, c.partnerId))!;
    expect(board.result.participants.map((p) => p.name)).toEqual(['Sam']);
    expect(board.viewer.isCreator).toBe(true);
  });

  it('removes a room nobody else is in', async () => {
    const u = await makeUser(db);
    const created = await createProject(db, u, { roomType: 'living_room', displayName: 'Solo' });
    await deleteMyData(db, u);
    expect(await db.select().from(project).where(eq(project.id, created.projectId))).toHaveLength(
      0,
    );
  });
});

describe('image checks (R33)', () => {
  it('retires an item after two failures in a row and resets on success', async () => {
    const items = await loadEngineItems(db, 'living_room');
    const bad = items[0].id;
    const flaky = items[1].id;
    // Make exactly one item fail by URL.
    await db
      .update(catalogueItem)
      .set({ imageUrl: 'https://broken.example/x.jpg' })
      .where(eq(catalogueItem.id, bad));
    const run = () =>
      checkImages(db, async (url) => ({ ok: !url.includes('broken.example'), status: 404 }), {
        siteUrl: 'http://x',
      });
    expect(await run()).toMatchObject({ failed: 1, retired: 0 });
    const [once] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, bad));
    expect(once).toMatchObject({ imageFailures: 1, status: 'live' });
    expect(await run()).toMatchObject({ failed: 1, retired: 1 });
    const [twice] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, bad));
    expect(twice.status).toBe('retired');

    await reportImageFailure(db, flaky);
    await checkImages(db, async () => ({ ok: true, status: 200 }), { siteUrl: 'http://x' });
    const [reset] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, flaky));
    expect(reset.imageFailures).toBe(0);
  });
});

describe('item stats (§12)', () => {
  it('counts likes, tie-breaker mutual yeses, clicks and purchases without anything personal', async () => {
    const { refreshItemStats } = await import('@/lib/stats/item-stats');
    const { itemStats, outboundClick, shoppingListItem } = await import('@/db/schema');
    const { startTiebreak, afterBridgeSwipes } = await import('@/lib/tiebreak');
    const { recordSwipes } = await import('@/lib/swipes');
    const { newId } = await import('@/lib/ids');
    const c = await revealedCouple();

    const round = await startTiebreak(db, c.projectId);
    const [yes, ...rest] = round.itemIds;
    for (const pid of [c.participantId, c.partnerId]) {
      await recordSwipes(
        db,
        pid,
        round.itemIds.map((id, i) => ({
          clientId: `${pid}-stat-${i}`.padEnd(10, 'x'),
          itemId: id,
          round: 'bridge' as const,
          value: id === yes ? (1 as const) : pid === c.participantId ? (1 as const) : (-1 as const),
        })),
      );
    }
    await afterBridgeSwipes(db, c.projectId);
    await db.insert(outboundClick).values({ id: newId(), itemId: yes, surface: 'board' });
    await db
      .update(shoppingListItem)
      .set({ boughtAt: new Date() })
      .where(eq(shoppingListItem.itemId, yes));

    await refreshItemStats(db);
    const [row] = await db.select().from(itemStats).where(eq(itemStats.itemId, yes));
    expect(row).toMatchObject({ tiebreakShown: 1, tiebreakMutualYes: 1, clicks: 1 });
    const [other] = await db.select().from(itemStats).where(eq(itemStats.itemId, rest[0]));
    expect(other).toMatchObject({ tiebreakShown: 1, tiebreakMutualYes: 0 });
    const swiped = (await db.select().from(itemStats)).filter((r) => r.exposures > 0);
    expect(swiped.length).toBeGreaterThan(20);
    // Running it again gives the same numbers: it recomputes, it doesn't double count.
    await refreshItemStats(db);
    const [again] = await db.select().from(itemStats).where(eq(itemStats.itemId, yes));
    expect(again).toMatchObject({ tiebreakShown: 1, tiebreakMutualYes: 1, clicks: 1 });
  });
});
