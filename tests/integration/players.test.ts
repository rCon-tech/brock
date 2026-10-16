import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { getToday } from '@/lib/brock-service';
import { hashToken, newToken } from '@/lib/identity';
import {
  claimHandle,
  createAnonymousPlayer,
  getPlayerById,
  getPlayerByToken,
  getProfile,
  logInAs,
} from '@/lib/players';
import { createPlayer } from './setup';
import { lose, win } from './helpers';

const NOW = new Date('2026-11-01T10:00:00Z');

/** Ends today's run (one win, then a loss) so the player may name themselves. */
async function finishBrock(playerId: string) {
  await win(playerId, NOW);
  await lose(playerId, NOW);
}

/** A named player logged in on one browser. */
async function namedPlayer(handle = 'rich') {
  const token = newToken();
  const created = await createAnonymousPlayer(hashToken(token));
  await finishBrock(created.id);
  await claimHandle(created.id, handle);
  return { id: created.id, token };
}

describe('anonymous players', () => {
  it('are found by their token, and only by the exact token', async () => {
    const token = newToken();
    const created = await createAnonymousPlayer(hashToken(token));

    expect(created.handle).toBeNull();
    expect((await getPlayerByToken(token))?.id).toBe(created.id);
    expect(await getPlayerByToken(newToken())).toBeNull();
    expect(await getPlayerByToken('')).toBeNull();
  });

  it('never store the raw token', async () => {
    const token = newToken();
    await createAnonymousPlayer(hashToken(token));
    const sessions = await getDb().select().from(schema.playerSession);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(token);
    expect(sessions[0].tokenHash).toBe(hashToken(token));
  });
});

describe('claimHandle', () => {
  it('requires a finished run first', async () => {
    const id = await createPlayer(null);
    await expect(claimHandle(id, 'rich')).rejects.toMatchObject({ code: 'play_first' });

    await getToday(id, NOW); // a run that is still going doesn't count, even after a win
    await win(id, NOW);
    await expect(claimHandle(id, 'rich')).rejects.toMatchObject({ code: 'play_first' });
  });

  it('names the player', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);

    expect((await claimHandle(id, 'Rich_B')).handle).toBe('Rich_B');
    expect((await getPlayerById(id))?.handle).toBe('Rich_B');
  });

  it('keeps the scores earned before naming', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);
    const before = await getPlayerById(id);

    await claimHandle(id, 'rich');
    expect(await getPlayerById(id)).toMatchObject({
      bestScore: 1,
      totalWins: before!.totalWins,
      totalLosses: before!.totalLosses,
    });
  });

  it('rejects a handle that is taken, ignoring case', async () => {
    await createPlayer('Rich');
    const id = await createPlayer(null);
    await finishBrock(id);

    await expect(claimHandle(id, 'rich')).rejects.toMatchObject({ code: 'handle_taken' });
    expect((await getPlayerById(id))?.handle).toBeNull();
  });

  it('rejects invalid handles', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);
    for (const bad of ['ab', 'has space', 'x'.repeat(21), 'emoji🪨', '<script>', '']) {
      await expect(claimHandle(id, bad)).rejects.toMatchObject({ code: 'invalid_request' });
    }
  });

  it('can only be done once', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);
    await claimHandle(id, 'first');

    await expect(claimHandle(id, 'second')).rejects.toMatchObject({ code: 'already_named' });
    expect((await getPlayerById(id))?.handle).toBe('first');
  });

  it('lets only one of several simultaneous claims win', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);

    const results = await Promise.allSettled(
      ['one_a', 'one_b', 'one_c', 'one_d'].map((h) => claimHandle(id, h)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await getPlayerById(id))?.handle).toMatch(/^one_[a-d]$/);
  });

  it('rejects an unknown player', async () => {
    await expect(claimHandle(randomUUID(), 'rich')).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('logInAs', () => {
  it('logs a new browser in as the player, by handle alone', async () => {
    const { id } = await namedPlayer();

    const { player, token } = await logInAs('rich');
    expect(player.id).toBe(id);
    expect((await getPlayerByToken(token))?.id).toBe(id);
  });

  it('keeps the other devices logged in', async () => {
    const { id, token: phone } = await namedPlayer();

    const { token: laptop } = await logInAs('rich');
    const { token: tablet } = await logInAs('rich');

    for (const t of [phone, laptop, tablet]) {
      expect((await getPlayerByToken(t))?.id).toBe(id);
    }
    const sessions = await getDb()
      .select()
      .from(schema.playerSession)
      .where(eq(schema.playerSession.playerId, id));
    expect(sessions).toHaveLength(3);
  });

  it('matches the handle ignoring case and surrounding spaces', async () => {
    const { id } = await namedPlayer('RichB');
    expect((await logInAs('  richb ')).player.id).toBe(id);
  });

  it('shares one player across devices', async () => {
    const { id } = await namedPlayer();
    const { token } = await logInAs('rich');
    const viaLogin = await getPlayerByToken(token);
    const original = await getPlayerById(id);
    expect(viaLogin).toEqual(original);
  });

  it('says not_found for a handle nobody has', async () => {
    await createPlayer(null); // unnamed players can never be logged into
    await expect(logInAs('nobody')).rejects.toMatchObject({ code: 'not_found' });
    await expect(logInAs('')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('getProfile', () => {
  it('lists 30 days, oldest first, with each run’s score', async () => {
    const { id } = await namedPlayer(); // a run of 1 on NOW
    await win(id, new Date('2026-11-03T10:00:00Z')); // still going on the 3rd

    const profile = await getProfile('RICH', '2026-11-03');
    expect(profile?.player.id).toBe(id);
    expect(profile!.days).toHaveLength(30);
    expect(profile!.days.slice(-3)).toEqual([
      { day: '2026-11-01', score: 1, playing: false },
      { day: '2026-11-02', score: null, playing: false },
      { day: '2026-11-03', score: 1, playing: true },
    ]);
  });

  it('is null for an unknown handle', async () => {
    expect(await getProfile('nobody', '2026-11-03')).toBeNull();
  });
});

describe('schema', () => {
  it('allows many unnamed players but never two with the same handle', async () => {
    await createPlayer(null);
    await createPlayer(null);
    await createPlayer('same');
    await expect(createPlayer('SAME')).rejects.toThrow();
    expect(
      await getDb().select().from(schema.player).where(eq(schema.player.handle, 'same')),
    ).toHaveLength(1);
  });

  it('removes a player’s sessions when the player is deleted', async () => {
    const { id } = await namedPlayer();
    await logInAs('rich');
    await getDb().delete(schema.player).where(eq(schema.player.id, id));
    expect(await getDb().select().from(schema.playerSession)).toHaveLength(0);
  });
});
