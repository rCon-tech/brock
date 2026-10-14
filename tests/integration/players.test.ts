import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { getToday, submitThrow } from '@/lib/brock-service';
import { hashRecoveryCode, hashToken, newToken } from '@/lib/identity';
import {
  claimHandle,
  createAnonymousPlayer,
  getPlayerById,
  getPlayerByToken,
  recoverPlayer,
} from '@/lib/players';
import { resetRateLimits } from '@/lib/rate-limit';
import { createPlayer } from './setup';

const NOW = new Date('2026-11-01T10:00:00Z');
const CODE_SHAPE = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/;

/** Finishes today's Brock (win or loss, whichever the House allows) so the player may name themselves. */
async function finishBrock(playerId: string) {
  for (let i = 0; i < 50; i++) {
    const state = await getToday(playerId, NOW);
    if (state.status !== 'pending') return;
    await submitThrow(playerId, { roundNo: state.openRound!.roundNo, throw: 'rock' }, NOW);
  }
  throw new Error('50 draws in a row');
}

beforeEach(() => resetRateLimits());

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
    const created = await createAnonymousPlayer(hashToken(token));
    expect(created.tokenHash).not.toBe(token);
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('claimHandle', () => {
  it('requires a finished Brock first', async () => {
    const id = await createPlayer(null);
    await expect(claimHandle(id, 'rich')).rejects.toMatchObject({ code: 'play_first' });

    await getToday(id, NOW); // a Brock that is open but not finished doesn't count
    await expect(claimHandle(id, 'rich')).rejects.toMatchObject({ code: 'play_first' });
  });

  it('names the player and returns a one-time recovery code, stored only as a hash', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);

    const { player, recoveryCode } = await claimHandle(id, 'Rich_B');
    expect(player.handle).toBe('Rich_B');
    expect(recoveryCode).toMatch(CODE_SHAPE);

    const stored = await getPlayerById(id);
    expect(stored?.recoveryHash).toBe(hashRecoveryCode(recoveryCode));
    expect(JSON.stringify(stored)).not.toContain(recoveryCode);
  });

  it('keeps the streak that was earned before naming', async () => {
    const id = await createPlayer(null);
    await finishBrock(id);
    const before = await getPlayerById(id);

    await claimHandle(id, 'rich');
    const after = await getPlayerById(id);
    expect(after).toMatchObject({
      currentStreak: before!.currentStreak,
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

describe('recoverPlayer', () => {
  async function namedPlayer(handle = 'rich') {
    const token = newToken();
    const created = await createAnonymousPlayer(hashToken(token));
    await finishBrock(created.id);
    const { recoveryCode } = await claimHandle(created.id, handle);
    return { id: created.id, token, recoveryCode };
  }

  it('restores the player on a new browser and rotates both token and code', async () => {
    const { id, token, recoveryCode } = await namedPlayer();
    const before = await getPlayerById(id);

    const restored = await recoverPlayer('rich', recoveryCode);
    expect(restored.player.id).toBe(id);
    expect(restored.token).not.toBe(token);
    expect(restored.recoveryCode).toMatch(CODE_SHAPE);
    expect(restored.recoveryCode).not.toBe(recoveryCode);

    // New browser works; the old browser is signed out; the old code is dead.
    expect((await getPlayerByToken(restored.token))?.id).toBe(id);
    expect(await getPlayerByToken(token)).toBeNull();
    await expect(recoverPlayer('rich', recoveryCode)).rejects.toMatchObject({
      code: 'invalid_recovery',
    });
    // Streak is untouched.
    const after = await getPlayerById(id);
    expect(after).toMatchObject({
      currentStreak: before!.currentStreak,
      bestStreak: before!.bestStreak,
      handle: 'rich',
    });
  });

  it('accepts the code in any case and with any separators', async () => {
    const { recoveryCode } = await namedPlayer();
    const sloppy = ` ${recoveryCode.toLowerCase().replaceAll('-', ' ')} `;
    await expect(recoverPlayer('RICH', sloppy)).resolves.toMatchObject({
      player: { handle: 'rich' },
    });
  });

  it('gives the same error for a wrong code, an unknown handle, and a malformed code', async () => {
    const { recoveryCode } = await namedPlayer();
    const wrongCode = recoveryCode.replace(/^./, recoveryCode[0] === 'A' ? 'B' : 'A');

    for (const [handle, code] of [
      ['rich', wrongCode],
      ['nobody', recoveryCode],
      ['rich', 'short'],
      ['rich', ''],
    ] as const) {
      await expect(recoverPlayer(handle, code)).rejects.toMatchObject({ code: 'invalid_recovery' });
    }
  });

  it('cannot recover a player who never claimed a handle', async () => {
    const id = await createPlayer(null);
    await expect(recoverPlayer(id, 'AAAA-AAAA-AAAA-AAAA')).rejects.toMatchObject({
      code: 'invalid_recovery',
    });
  });

  it('rate limits guesses per handle, even when the right code follows', async () => {
    const { recoveryCode } = await namedPlayer();
    for (let i = 0; i < 5; i++) {
      await expect(recoverPlayer('rich', 'WRONG-CODE-0000-0000')).rejects.toMatchObject({
        code: 'invalid_recovery',
      });
    }
    await expect(recoverPlayer('rich', recoveryCode)).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('lets only one of several simultaneous recoveries succeed', async () => {
    const { recoveryCode } = await namedPlayer();
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => recoverPlayer('rich', recoveryCode)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
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
});
