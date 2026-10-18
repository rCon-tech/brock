import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { participant, swipe, veto } from '@/db/schema';
import { createProject } from '@/lib/projects';
import {
  finishRound,
  getDeckState,
  recordSwipes,
  recordVeto,
  startOver,
  undoSwipe,
} from '@/lib/swipes';
import { freshDb, makeUser, swipeDeck } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

async function setup() {
  const u = await makeUser(db);
  const { projectId, participantId } = await createProject(db, u, {
    roomType: 'living_room',
    displayName: 'Rich',
  });
  return { u, projectId, participantId };
}

const swipeOf = (
  clientId: string,
  itemId: string,
  round: 'macro' | 'micro',
  value: 1 | -1 = 1,
) => ({
  clientId,
  itemId,
  round,
  value,
});

describe('recording swipes', () => {
  it('saves each answer once, even when the same batch is sent again (R32)', async () => {
    const { participantId } = await setup();
    const state = await getDeckState(db, participantId);
    const batch = state.remainingMacro
      .slice(0, 3)
      .map((id, i) => swipeOf(`client-id-${i}-aaaa`, id, 'macro'));
    expect(await recordSwipes(db, participantId, batch)).toEqual({ saved: 3, rejected: [] });
    await recordSwipes(db, participantId, batch);
    const rows = await db.select().from(swipe).where(eq(swipe.participantId, participantId));
    expect(rows).toHaveLength(3);
  });

  it('lets a later answer replace an earlier one for the same card', async () => {
    const { participantId } = await setup();
    const [first] = (await getDeckState(db, participantId)).remainingMacro;
    await recordSwipes(db, participantId, [swipeOf('first-click-aaaa', first, 'macro', 1)]);
    await recordSwipes(db, participantId, [swipeOf('second-click-bbb', first, 'macro', -1)]);
    const rows = await db.select().from(swipe).where(eq(swipe.participantId, participantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(-1);
  });

  it('rejects cards outside the deck without failing the rest of the batch', async () => {
    const { participantId } = await setup();
    const [ok] = (await getDeckState(db, participantId)).remainingMacro;
    const result = await recordSwipes(db, participantId, [
      swipeOf('good-swipe-aaa', ok, 'macro'),
      swipeOf('bad-swipe-aaaa', 'not-a-card', 'macro'),
    ]);
    expect(result).toEqual({ saved: 1, rejected: ['bad-swipe-aaaa'] });
  });

  it('shows each person the same cards in their own order (R7)', async () => {
    const owner = await makeUser(db);
    const { projectId, participantId, inviteToken } = await createProject(db, owner, {
      roomType: 'living_room',
      displayName: 'Rich',
    });
    const { acceptInvite } = await import('@/lib/invites');
    const partner = await acceptInvite(db, inviteToken, await makeUser(db), 'Sam');
    expect(projectId).toBeTruthy();
    const sa = await getDeckState(db, participantId);
    const sb = await getDeckState(db, partner.participantId);
    expect(sa.macro).toHaveLength(12);
    expect(sa.micro).toHaveLength(18);
    expect([...sa.macro].sort()).toEqual([...sb.macro].sort());
    expect([...sa.micro].sort()).toEqual([...sb.micro].sort());
    expect(sa.macro).not.toEqual(sb.macro);
    expect((await getDeckState(db, participantId)).macro).toEqual(sa.macro); // stable per person
  });

  it('resumes where the person left off', async () => {
    const { participantId } = await setup();
    const state = await getDeckState(db, participantId);
    await recordSwipes(
      db,
      participantId,
      state.remainingMacro.slice(0, 5).map((id, i) => swipeOf(`resume-${i}-aaaaa`, id, 'macro')),
    );
    const after = await getDeckState(db, participantId);
    expect(after.remainingMacro).toEqual(state.macro.slice(5));
  });

  it('undoes the last swipe', async () => {
    const { participantId } = await setup();
    const [card] = (await getDeckState(db, participantId)).remainingMacro;
    await recordSwipes(db, participantId, [swipeOf('undo-me-aaaaaa', card, 'macro')]);
    await undoSwipe(db, participantId, card);
    expect((await getDeckState(db, participantId)).remainingMacro).toContain(card);
  });
});

describe('finishing rounds', () => {
  it('needs every card answered', async () => {
    const { participantId } = await setup();
    await expect(finishRound(db, participantId, 'macro')).rejects.toThrow(/still cards/i);
  });

  it('lets a failed card be replaced by a reserve (R33)', async () => {
    const { participantId } = await setup();
    const state = await getDeckState(db, participantId);
    const answered = [...state.remainingMacro.slice(1), state.reserveMacro[0]];
    await recordSwipes(
      db,
      participantId,
      answered.map((id, i) => swipeOf(`reserve-${i}-aaaaa`, id, 'macro')),
    );
    const p = await finishRound(db, participantId, 'macro');
    expect(p.macroDoneAt).not.toBeNull();
  });

  it('ignores swipes sent after the round is finished', async () => {
    const { participantId } = await setup();
    await swipeDeck(db, participantId, () => true);
    const [card] = (await getDeckState(db, participantId)).macro;
    const res = await recordSwipes(db, participantId, [
      swipeOf('too-late-aaaaaa', card, 'macro', -1),
    ]);
    expect(res.saved).toBe(0);
    expect(res.rejected).toEqual(['too-late-aaaaaa']);
  });
});

describe('vetoes (R9)', () => {
  it('allows three, then refuses', async () => {
    const { participantId } = await setup();
    const { remainingMicro } = await getDeckState(db, participantId);
    for (let i = 0; i < 3; i++) {
      const out = await recordVeto(db, participantId, {
        itemId: remainingMicro[i],
        clientId: `veto-${i}-aaaaaa`,
      });
      expect(out.vetoesLeft).toBe(2 - i);
    }
    await expect(
      recordVeto(db, participantId, { itemId: remainingMicro[3], clientId: 'veto-3-aaaaaa' }),
    ).rejects.toThrow(/used all/i);
    const [p] = await db.select().from(participant).where(eq(participant.id, participantId));
    expect(p.vetoesLeft).toBe(0);
  });

  it('counts a veto as a left swipe and records the named deal-breaker', async () => {
    const { participantId } = await setup();
    const { remainingMicro } = await getDeckState(db, participantId);
    const { catalogueItem } = await import('@/db/schema');
    const [item] = await db
      .select()
      .from(catalogueItem)
      .where(eq(catalogueItem.id, remainingMicro[0]));
    const attribute = item.attributes.find((a) => a.startsWith('material:'))!;
    await recordVeto(db, participantId, { itemId: item.id, attribute, clientId: 'veto-attr-aaaa' });
    const [s] = await db
      .select()
      .from(swipe)
      .where(and(eq(swipe.itemId, item.id), eq(swipe.participantId, participantId)));
    expect(s.value).toBe(-1);
    const [v] = await db.select().from(veto).where(eq(veto.participantId, participantId));
    expect(v.attribute).toBe(attribute);
  });

  it('refuses a deal-breaker the card does not have', async () => {
    const { participantId } = await setup();
    const { remainingMicro } = await getDeckState(db, participantId);
    await expect(
      recordVeto(db, participantId, {
        itemId: remainingMicro[0],
        attribute: 'practical:glass_top',
        clientId: 'veto-bad-aaaaa',
      }),
    ).rejects.toThrow(/features/i);
  });

  it('is idempotent and gives the token back on undo', async () => {
    const { participantId } = await setup();
    const { remainingMicro } = await getDeckState(db, participantId);
    await recordVeto(db, participantId, { itemId: remainingMicro[0], clientId: 'veto-twice-aaaa' });
    await recordVeto(db, participantId, { itemId: remainingMicro[0], clientId: 'veto-twice-bbbb' });
    expect((await getDeckState(db, participantId)).vetoesLeft).toBe(2);
    await undoSwipe(db, participantId, remainingMicro[0]);
    expect((await getDeckState(db, participantId)).vetoesLeft).toBe(3);
  });
});

describe('starting over (R31)', () => {
  it('clears swipes, vetoes and progress before the reveal', async () => {
    const { participantId } = await setup();
    await swipeDeck(db, participantId, () => true);
    const { remainingMicro } = await getDeckState(db, participantId);
    expect(remainingMicro).toHaveLength(0);
    await startOver(db, participantId);
    const state = await getDeckState(db, participantId);
    expect(state.remainingMacro).toHaveLength(12);
    expect(state.remainingMicro).toHaveLength(18);
    expect(state.macroDone || state.microDone).toBe(false);
    expect(state.vetoesLeft).toBe(3);
  });
});
