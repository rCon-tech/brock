import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { listActive } from '@/lib/installed-modules';
import { removeMember } from '@/lib/members';
import { closeExpired, listProposals, propose, vote, withdraw } from '@/lib/proposals';
import { makeHabitat, setRole } from './factories';

const HOUR = 3600_000;
const activeIds = async (id: string) => (await listActive(getDb(), id)).map((a) => a.manifest.id);

describe('proposals', () => {
  it('a 2-person habitat needs both people to add a module', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    expect(p.status).toBe('open');
    expect(p.yes).toBe(1);
    expect(await activeIds(h.id)).not.toContain('polls');
    const done = await vote(h.members[1]!, p.id, 'yes');
    expect(done.status).toBe('passed');
    expect(await activeIds(h.id)).toContain('polls');
  });

  it('a single no in a 2-person habitat rejects it', async () => {
    const h = await makeHabitat({ members: 2 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    expect((await vote(h.members[1]!, p.id, 'no')).status).toBe('rejected');
    expect(await activeIds(h.id)).not.toContain('polls');
  });

  it('a solo habitat passes its own proposal at once', async () => {
    const h = await makeHabitat();
    expect((await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' })).status).toBe('passed');
  });

  it('6 members: passes on the 4th yes, fails on the 3rd no', async () => {
    const h = await makeHabitat({ members: 6 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await vote(h.members[1]!, p.id, 'yes');
    expect((await vote(h.members[2]!, p.id, 'yes')).status).toBe('open');
    expect((await vote(h.members[3]!, p.id, 'yes')).status).toBe('passed');

    const q = await propose(h.members[0]!, { kind: 'install', moduleId: 'birthdays' });
    await vote(h.members[1]!, q.id, 'no');
    await vote(h.members[2]!, q.id, 'no');
    expect((await vote(h.members[3]!, q.id, 'no')).status).toBe('rejected');
  });

  it('allows changing your vote while open', async () => {
    const h = await makeHabitat({ members: 5 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await vote(h.members[1]!, p.id, 'no');
    const after = await vote(h.members[1]!, p.id, 'yes');
    expect(after).toMatchObject({ yes: 2, no: 0, myVote: 'yes' });
  });

  it('only one open proposal per module (409), but other modules are fine', async () => {
    const h = await makeHabitat({ members: 3 });
    await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await expect(propose(h.members[1]!, { kind: 'install', moduleId: 'polls' })).rejects.toMatchObject({
      status: 409,
      code: 'proposal_already_open',
    });
    await propose(h.members[1]!, { kind: 'install', moduleId: 'birthdays' });
  });

  it('refuses to install what is installed, or an unknown module', async () => {
    const h = await makeHabitat({ members: 2 });
    await expect(propose(h.members[0]!, { kind: 'install', moduleId: 'feed' })).rejects.toMatchObject({ status: 409 });
    await expect(propose(h.members[0]!, { kind: 'install', moduleId: 'nope' })).rejects.toMatchObject({ status: 404 });
    await expect(propose(h.members[0]!, { kind: 'uninstall', moduleId: 'polls' })).rejects.toMatchObject({ status: 409 });
  });

  it('concurrency: 6 members voting yes at once install the module exactly once', async () => {
    const h = await makeHabitat({ members: 6 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    const results = await Promise.allSettled(h.members.slice(1).map((m) => vote(m, p.id, 'yes')));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(failures.every((f) => f.reason.code === 'proposal_closed')).toBe(true);
    const rows = await getDb().select().from(s.installedModule).where(eq(s.installedModule.moduleId, 'polls'));
    expect(rows).toHaveLength(1);
    const audit = await getDb().select().from(s.auditLog).where(eq(s.auditLog.action, 'proposal.passed'));
    expect(audit).toHaveLength(1);
  });

  it('cron closes an expired proposal with the window-close rule', async () => {
    const h = await makeHabitat({ members: 9 });
    const t0 = new Date('2026-03-01T00:00:00Z');
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' }, t0);
    await vote(h.members[1]!, p.id, 'yes', t0);
    await vote(h.members[2]!, p.id, 'no', t0);
    expect(await closeExpired(new Date(t0.getTime() + 47 * HOUR))).toBe(0);
    expect(await closeExpired(new Date(t0.getTime() + 49 * HOUR))).toBe(1);
    expect(await activeIds(h.id)).toContain('polls'); // 2 yes / 1 no, turnout 3 of 9 = 1/3
  });

  it('cron rejects a low-turnout proposal', async () => {
    const h = await makeHabitat({ members: 9 });
    const t0 = new Date('2026-03-01T00:00:00Z');
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' }, t0);
    await vote(h.members[1]!, p.id, 'yes', t0);
    await closeExpired(new Date(t0.getTime() + 49 * HOUR));
    expect((await listProposals(h.members[0]!))[0]!.status).toBe('rejected');
    expect(await activeIds(h.id)).not.toContain('polls');
  });

  it('a late vote after the window closes is refused', async () => {
    const h = await makeHabitat({ members: 3 });
    const t0 = new Date('2026-03-01T00:00:00Z');
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' }, t0);
    await expect(vote(h.members[1]!, p.id, 'yes', new Date(t0.getTime() + 50 * HOUR))).rejects.toMatchObject({
      code: 'proposal_closed',
    });
  });

  it('a member leaving mid-vote moves the threshold', async () => {
    const h = await makeHabitat({ members: 6 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await vote(h.members[1]!, p.id, 'yes');
    await vote(h.members[2]!, p.id, 'yes'); // 3 of 6: open
    await removeMember(h.members[5]!, h.members[5]!.userId); // 3 of 5: passes
    expect(await activeIds(h.id)).toContain('polls');
  });

  it('votes from people who left are not counted', async () => {
    const h = await makeHabitat({ members: 5 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await vote(h.members[1]!, p.id, 'yes');
    await removeMember(h.members[1]!, h.members[1]!.userId);
    const dto = (await listProposals(h.members[0]!))[0]!;
    expect(dto.yes).toBe(1);
    expect(dto.memberCount).toBe(4);
  });

  it('uninstall and reinstall via votes; a withdrawn proposal frees the slot', async () => {
    const h = await makeHabitat();
    const u = await propose(h.members[0]!, { kind: 'uninstall', moduleId: 'chat' });
    expect(u.status).toBe('passed');
    expect(await activeIds(h.id)).not.toContain('chat');
    const h2 = await makeHabitat({ members: 3 });
    const p = await propose(h2.members[0]!, { kind: 'install', moduleId: 'polls' });
    await withdraw(h2.members[0]!, p.id);
    await propose(h2.members[1]!, { kind: 'install', moduleId: 'polls' });
  });

  it('only the proposer or an admin can withdraw', async () => {
    const h = await makeHabitat({ members: 3 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await expect(withdraw(h.members[2]!, p.id)).rejects.toMatchObject({ status: 403 });
  });

  it('a vote in another habitat is a 404', async () => {
    const a = await makeHabitat({ members: 3 });
    const b = await makeHabitat({ members: 3 });
    const p = await propose(a.members[0]!, { kind: 'install', moduleId: 'polls' });
    await expect(vote(b.members[0]!, p.id, 'yes')).rejects.toMatchObject({ status: 404 });
  });

  it('governance can be changed by a vote; admins mode lets one admin decide', async () => {
    const h = await makeHabitat({ members: 3 });
    const g = await propose(h.members[0]!, { kind: 'governance', payload: { mode: 'admins' } });
    await vote(h.members[1]!, g.id, 'yes');
    const [row] = await getDb().select().from(s.habitat).where(eq(s.habitat.id, h.id));
    expect(row!.governance).toBe('admins');
    const p = await propose(h.members[1]!, { kind: 'install', moduleId: 'polls' });
    expect(p.status).toBe('open'); // a plain member's vote changes nothing
    await setRole(h, 2, 'admin');
    expect((await vote(h.members[2]!, p.id, 'yes')).status).toBe('passed');
  });

  it('unanimous mode fails on any no', async () => {
    const h = await makeHabitat({ members: 3, governance: 'unanimous' });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    await vote(h.members[1]!, p.id, 'yes');
    expect((await vote(h.members[2]!, p.id, 'no')).status).toBe('rejected');
  });

  it('notifies other members when a vote opens and when it ends', async () => {
    const h = await makeHabitat({ members: 3 });
    const p = await propose(h.members[0]!, { kind: 'install', moduleId: 'polls' });
    const opened = await getDb().select().from(s.notification).where(eq(s.notification.type, 'proposal.opened'));
    expect(opened.map((n) => n.userId).sort()).toEqual([h.members[1]!.userId, h.members[2]!.userId].sort());
    await vote(h.members[1]!, p.id, 'yes');
    const decided = await getDb().select().from(s.notification).where(eq(s.notification.type, 'proposal.decided'));
    expect(decided).toHaveLength(3);
    expect(
      await getDb().select().from(s.installedModule).where(and(eq(s.installedModule.moduleId, 'polls'), isNull(s.installedModule.removedAt))),
    ).toHaveLength(1);
  });
});
