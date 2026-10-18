import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { participant, project, shoppingListItem, synthesis } from '@/db/schema';
import { getBoard, submitFeedback } from '@/lib/board';
import { acceptInvite, createInvite } from '@/lib/invites';
import { removeParticipant } from '@/lib/participants';
import { createProject } from '@/lib/projects';
import { react } from '@/lib/reactions';
import { afterFinished, markReady, maybeReveal } from '@/lib/reveal';
import { setBought, setSaved, shoppingTotal } from '@/lib/shopping';
import { swapPick, undoSwap } from '@/lib/swap';
import { latestSynthesis, nameSynthesis, synthesiseAndName } from '@/lib/synthesis';
import { afterBridgeSwipes, startTiebreak, tiebreakState } from '@/lib/tiebreak';
import { recordSwipes } from '@/lib/swipes';
import { INDUSTRIAL, MINIMAL, freshDb, makeUser, styleCard, swipeDeck } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

/** Rich likes industrial, Sam likes minimal. Both finished but the board is not out yet. */
async function couple(opts: { budgetBand?: 'low' | 'mid' | 'high'; finish?: boolean } = {}) {
  const richUser = await makeUser(db, 'Rich');
  const samUser = await makeUser(db, 'Sam');
  const created = await createProject(db, richUser, {
    roomType: 'living_room',
    displayName: 'Rich',
    budgetBand: opts.budgetBand,
  });
  const sam = await acceptInvite(db, created.inviteToken, samUser, 'Sam');
  if (opts.finish !== false) {
    await swipeDeck(db, created.participantId, styleCard(...INDUSTRIAL));
    await swipeDeck(db, sam.participantId, styleCard(...MINIMAL));
  }
  return {
    projectId: created.projectId,
    rich: created.participantId,
    sam: sam.participantId,
    richUser,
    samUser,
  };
}

async function reveal(c: { projectId: string; rich: string; sam: string }) {
  await markReady(db, c.rich);
  await markReady(db, c.sam);
  const out = await maybeReveal(db, c.projectId);
  await nameSynthesis(db, c.projectId, out.version!);
  return out;
}

describe('the reveal (R10, R18)', () => {
  it('keeps the board hidden until everyone has finished and tapped Ready', async () => {
    const c = await couple({ finish: false });
    await swipeDeck(db, c.rich, styleCard(...INDUSTRIAL));
    await markReady(db, c.rich);
    expect(await maybeReveal(db, c.projectId)).toEqual({ revealed: false });
    expect(await getBoard(db, c.projectId, c.rich)).toBeNull();
    await swipeDeck(db, c.sam, styleCard(...MINIMAL));
    expect(await maybeReveal(db, c.projectId)).toEqual({ revealed: false }); // Sam not ready yet
    await markReady(db, c.sam);
    const out = await maybeReveal(db, c.projectId);
    expect(out.revealed).toBe(true);
    expect(out.version).toBe(1);
  });

  it('will not let you tap Ready before finishing', async () => {
    const c = await couple({ finish: false });
    await expect(markReady(db, c.rich)).rejects.toThrow(/finish swiping/i);
  });

  it('can be forced once two people have finished', async () => {
    const c = await couple();
    expect((await maybeReveal(db, c.projectId, { force: true })).revealed).toBe(true);
  });

  it('cannot be forced with only one person finished, or one person in the room', async () => {
    const c = await couple({ finish: false });
    await swipeDeck(db, c.rich, styleCard(...INDUSTRIAL));
    expect((await maybeReveal(db, c.projectId, { force: true })).revealed).toBe(false);
    const solo = await createProject(db, await makeUser(db), {
      roomType: 'living_room',
      displayName: 'Solo',
    });
    await swipeDeck(db, solo.participantId, () => true);
    await markReady(db, solo.participantId);
    expect((await maybeReveal(db, solo.projectId, { force: true })).revealed).toBe(false);
  });
});

describe('the board', () => {
  it('has a bridge, evidence, compromise picks and no scores (R19, R20)', async () => {
    const c = await couple();
    await reveal(c);
    const board = (await getBoard(db, c.projectId, c.rich))!;
    expect(board.kind).toBe('shared');
    expect(board.result.lead).toBe('bridge');
    expect(board.result.picks).toHaveLength(12);
    expect(board.naming.ready).toBe(true);
    expect(board.naming.name).toBeTruthy();
    expect(board.participants.map((p) => p.name).sort()).toEqual(['Rich', 'Sam']);
    // Every pick has a card to draw.
    for (const p of board.result.picks) expect(board.items[p.itemId]).toBeTruthy();
    expect(board.naming.rationale + board.naming.tagline).not.toMatch(/\d+\s?%|score|won|lost/i);
  });

  it('gives each person something of theirs (R21) and the same board to both', async () => {
    const c = await couple();
    await reveal(c);
    const a = (await getBoard(db, c.projectId, c.rich))!;
    const b = (await getBoard(db, c.projectId, c.sam))!;
    expect(a.result).toEqual(b.result);
    expect(a.result.brings[c.rich]).toBeTruthy();
    expect(a.result.brings[c.sam]).toBeTruthy();
    expect(a.viewer.isCreator).toBe(true);
    expect(b.viewer.isCreator).toBe(false);
  });

  it('does not rebuild when nothing changed', async () => {
    const c = await couple();
    await reveal(c);
    const again = await synthesiseAndName(db, c.projectId);
    expect(again).toEqual({ version: 1, changed: false });
  });

  it('records whether it helped (K1 metric)', async () => {
    const c = await couple();
    await reveal(c);
    await submitFeedback(db, c.rich, true);
    await submitFeedback(db, c.rich, false);
    expect((await getBoard(db, c.projectId, c.rich))!.feedback).toBe(false);
    expect((await getBoard(db, c.projectId, c.sam))!.feedback).toBeNull();
  });

  it('falls back to plain wording if naming throws', async () => {
    const c = await couple();
    const out = await maybeReveal(db, c.projectId, { force: true });
    await nameSynthesis(db, c.projectId, out.version!, async () => {
      throw new Error('model unavailable');
    });
    const row = (await latestSynthesis(db, c.projectId))!;
    expect(row.status).toBe('ready');
    expect(row.bridgeName).toBeTruthy();
    expect(row.aiModel).toBeNull();
  });
});

describe('solo board (R31)', () => {
  it('is available to a finished person when the other never starts, after the wait', async () => {
    const c = await couple({ finish: false });
    await swipeDeck(db, c.rich, styleCard(...INDUSTRIAL));
    expect(await getBoard(db, c.projectId, c.rich)).toBeNull(); // too soon
    await db
      .update(participant)
      .set({ joinedAt: new Date(Date.now() - 5000) })
      .where(eq(participant.id, c.rich));
    const board = (await getBoard(db, c.projectId, c.rich))!;
    expect(board.kind).toBe('solo');
    expect(board.result.solo).toBe(true);
    expect(await getBoard(db, c.projectId, c.sam)).toBeNull(); // Sam has not finished
  });

  it('is immediate for a one-person quiz room', async () => {
    const solo = await createProject(db, await makeUser(db), {
      roomType: 'living_room',
      displayName: 'Solo',
      isQuiz: true,
    });
    await swipeDeck(db, solo.participantId, styleCard(...INDUSTRIAL));
    expect((await getBoard(db, solo.projectId, solo.participantId))!.kind).toBe('solo');
  });
});

describe('late joiners and leavers (R31)', () => {
  it('updates the board when a late joiner finishes', async () => {
    const c = await couple();
    await reveal(c);
    const token = await createInvite(db, c.projectId);
    const alex = await acceptInvite(db, token, await makeUser(db, 'Alex'), 'Alex');
    await swipeDeck(db, alex.participantId, styleCard('boho', 'mid_century', 'rustic'));
    const out = await afterFinished(db, c.projectId);
    expect(out).toMatchObject({ changed: true, version: 2 });
    const board = (await getBoard(db, c.projectId, c.rich))!;
    expect(board.result.participants).toHaveLength(3);
    expect(board.joinedLate).toEqual(['Alex']);
  });

  it('rebuilds without someone who leaves, and removes their data', async () => {
    const c = await couple();
    await reveal(c);
    await removeParticipant(db, c.samUser, c.projectId, c.sam);
    const board = (await getBoard(db, c.projectId, c.rich))!;
    expect(board.result.participants.map((p) => p.name)).toEqual(['Rich']);
    expect(board.result.solo).toBe(true);
  });

  it('lets the creator remove someone, but nobody else, and never the creator', async () => {
    const c = await couple();
    await expect(removeParticipant(db, c.samUser, c.projectId, c.rich)).rejects.toThrow();
    await expect(removeParticipant(db, await makeUser(db), c.projectId, c.sam)).rejects.toThrow();
    await removeParticipant(db, c.richUser, c.projectId, c.sam);
    const left = await db.select().from(participant).where(eq(participant.projectId, c.projectId));
    expect(left).toHaveLength(1);
  });
});

describe('reactions (R29)', () => {
  async function board() {
    const c = await couple();
    await reveal(c);
    const b = (await getBoard(db, c.projectId, c.rich))!;
    return { c, itemId: b.result.picks[0].itemId };
  }

  it('puts an item on the shopping list when everyone loves it, and takes it off on a ✕', async () => {
    const { c, itemId } = await board();
    await react(db, c.rich, itemId, { reaction: 'love', note: 'love this but in green?' });
    let list = await db
      .select()
      .from(shoppingListItem)
      .where(eq(shoppingListItem.projectId, c.projectId));
    expect(list.map((l) => l.itemId)).not.toContain(itemId);
    await react(db, c.sam, itemId, { reaction: 'love' });
    list = await db
      .select()
      .from(shoppingListItem)
      .where(eq(shoppingListItem.projectId, c.projectId));
    expect(list.find((l) => l.itemId === itemId)?.source).toBe('loved');
    await react(db, c.sam, itemId, { reaction: 'no' });
    list = await db
      .select()
      .from(shoppingListItem)
      .where(eq(shoppingListItem.projectId, c.projectId));
    expect(list.map((l) => l.itemId)).not.toContain(itemId);
    const view = (await getBoard(db, c.projectId, c.rich))!;
    expect(view.notForUs).toContain(itemId);
    expect(view.reactions[itemId].find((r) => r.participantId === c.rich)?.note).toBe(
      'love this but in green?',
    );
  });

  it('limits notes to 140 characters and items to those on the board', async () => {
    const { c, itemId } = await board();
    await expect(
      react(db, c.rich, itemId, { reaction: 'love', note: 'x'.repeat(141) }),
    ).rejects.toThrow();
    await expect(react(db, c.rich, 'not-on-board', { reaction: 'love' })).rejects.toThrow(
      /isn't on the board/,
    );
  });

  it('clears a reaction', async () => {
    const { c, itemId } = await board();
    await react(db, c.rich, itemId, { reaction: 'unsure' });
    await react(db, c.rich, itemId, { reaction: null });
    expect((await getBoard(db, c.projectId, c.rich))!.reactions[itemId]).toBeUndefined();
  });
});

describe('swapping a pick (R28)', () => {
  it('replaces it with the next best in the same category, and can undo', async () => {
    const c = await couple();
    await reveal(c);
    const before = (await getBoard(db, c.projectId, c.rich))!;
    const pick = before.result.picks[0];
    const out = await swapPick(db, c.rich, pick.itemId);
    expect(out.exhausted).toBe(false);
    expect(out.to).toBeTruthy();
    const after = (await getBoard(db, c.projectId, c.rich))!;
    expect(after.result.picks.map((p) => p.itemId)).not.toContain(pick.itemId);
    expect(after.result.picks.map((p) => p.itemId)).toContain(out.to);
    expect(after.items[out.to!].category).toBe(pick.category);
    expect(after.notForUs).toContain(pick.itemId);
    expect(after.result.picks).toHaveLength(12);

    await undoSwap(db, c.rich, out.swapId!);
    const undone = (await getBoard(db, c.projectId, c.rich))!;
    expect(undone.result.picks).toEqual(before.result.picks);
    expect(undone.notForUs).not.toContain(pick.itemId);
  });

  it('says so when a category runs out', async () => {
    const c = await couple();
    await reveal(c);
    const pick = (await getBoard(db, c.projectId, c.rich))!.result.picks[0];
    let last = await swapPick(db, c.rich, pick.itemId);
    let guard = 0;
    while (!last.exhausted && guard++ < 40) {
      const board = (await getBoard(db, c.projectId, c.rich))!;
      const same = board.result.picks.find((p) => p.category === pick.category)!;
      last = await swapPick(db, c.rich, same.itemId);
    }
    expect(last.exhausted).toBe(true);
    expect(last.to).toBeNull();
  });

  it('refuses to undo someone else’s swap', async () => {
    const c = await couple();
    await reveal(c);
    const pick = (await getBoard(db, c.projectId, c.rich))!.result.picks[0];
    const out = await swapPick(db, c.rich, pick.itemId);
    await expect(undoSwap(db, c.sam, out.swapId!)).rejects.toThrow();
  });
});

describe('the tie-breaker (R11)', () => {
  it('turns a mutual yes into an agreed item on the shopping list, then rebuilds', async () => {
    const c = await couple();
    await reveal(c);
    const state0 = await tiebreakState(db, c.projectId, c.rich);
    expect(state0).toMatchObject({ roundsUsed: 0, canStart: true, current: null });

    const round = await startTiebreak(db, c.projectId);
    expect(round.itemIds).toHaveLength(8);
    await expect(startTiebreak(db, c.projectId)).rejects.toThrow(/already open/);

    const answer = (pid: string, yes: string[]) =>
      recordSwipes(
        db,
        pid,
        round.itemIds.map((id, i) => ({
          clientId: `${pid}-bridge-${i}`.padEnd(10, 'x'),
          itemId: id,
          round: 'bridge' as const,
          value: yes.includes(id) ? (1 as const) : (-1 as const),
        })),
      );
    await answer(c.rich, round.itemIds.slice(0, 3));
    expect(await afterBridgeSwipes(db, c.projectId)).toBe(false); // Sam still owes answers
    expect((await tiebreakState(db, c.projectId, c.sam)).remaining).toHaveLength(8);
    await answer(c.sam, round.itemIds.slice(0, 2));
    expect(await afterBridgeSwipes(db, c.projectId)).toBe(true);

    const board = (await getBoard(db, c.projectId, c.rich))!;
    expect(board.version).toBe(2);
    expect(board.result.exactMicro.sort()).toEqual(round.itemIds.slice(0, 2).sort());
    const agreed = board.shopping.filter((s) => s.source === 'tiebreak').map((s) => s.itemId);
    expect(agreed.sort()).toEqual(round.itemIds.slice(0, 2).sort());
    expect(board.tiebreak).toMatchObject({ roundsUsed: 1, canStart: true });
  });

  it('allows two rounds and no more, and never repeats a card', async () => {
    const c = await couple();
    await reveal(c);
    const seen = new Set<string>();
    for (let r = 0; r < 2; r++) {
      const round = await startTiebreak(db, c.projectId);
      for (const id of round.itemIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      for (const pid of [c.rich, c.sam]) {
        await recordSwipes(
          db,
          pid,
          round.itemIds.map((id, i) => ({
            clientId: `${pid}-r${r}-${i}`.padEnd(10, 'x'),
            itemId: id,
            round: 'bridge' as const,
            value: -1 as const,
          })),
        );
      }
      await afterBridgeSwipes(db, c.projectId);
    }
    await expect(startTiebreak(db, c.projectId)).rejects.toThrow(/both tie-breaker rounds/);
  });
});

describe('shopping list (R25, R34)', () => {
  it('totals in-stock items against the budget band and tracks purchases', async () => {
    const c = await couple({ budgetBand: 'mid' });
    await reveal(c);
    const board = (await getBoard(db, c.projectId, c.rich))!;
    const [a, b] = board.result.picks.map((p) => p.itemId);
    await setSaved(db, c.rich, a, true);
    await setSaved(db, c.sam, b, true);
    const total = await shoppingTotal(db, c.projectId);
    const priced = [a, b].map((id) => board.items[id].pricePence ?? 0);
    expect(total).toMatchObject({
      pence: priced[0] + priced[1],
      budgetPence: 400000,
      itemCount: 2,
    });

    await setBought(db, c.rich, a, true);
    const view = (await getBoard(db, c.projectId, c.rich))!;
    expect(view.shopping.find((s) => s.itemId === a)?.bought).toBe(true);
    await setBought(db, c.rich, a, false);
    await setSaved(db, c.rich, a, false);
    expect((await shoppingTotal(db, c.projectId)).itemCount).toBe(1);
    await expect(setBought(db, c.rich, 'nope', true)).rejects.toThrow();
  });

  it('has no budget ceiling without a band', async () => {
    const c = await couple();
    await reveal(c);
    expect((await shoppingTotal(db, c.projectId)).budgetPence).toBeNull();
  });
});

describe('board versions', () => {
  it('stores each rebuild as a new version', async () => {
    const c = await couple();
    await reveal(c);
    const round = await startTiebreak(db, c.projectId);
    for (const pid of [c.rich, c.sam]) {
      await recordSwipes(
        db,
        pid,
        round.itemIds.map((id, i) => ({
          clientId: `${pid}-v-${i}`.padEnd(10, 'x'),
          itemId: id,
          round: 'bridge' as const,
          value: 1 as const,
        })),
      );
    }
    await afterBridgeSwipes(db, c.projectId);
    const rows = await db.select().from(synthesis).where(eq(synthesis.projectId, c.projectId));
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
    const [proj] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, c.projectId)));
    expect(proj.revealedAt).not.toBeNull();
  });
});
