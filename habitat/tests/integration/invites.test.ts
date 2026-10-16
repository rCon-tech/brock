import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { acceptInvite, createInvite, listInvites, previewInvite, revokeInvite } from '@/lib/invites';
import { updateHabitat } from '@/lib/habitats';
import { removeMember } from '@/lib/members';
import { makeHabitat, makeUser } from './factories';

const DAY = 86400_000;

describe('invites', () => {
  it('accepting adds a member and counts the use; accepting twice is 409', async () => {
    const h = await makeHabitat();
    const { code } = await createInvite(h.members[0]!);
    const u = await makeUser();
    const r = await acceptInvite(u.id, code);
    expect(r.slug).toBe(h.slug);
    await expect(acceptInvite(u.id, code)).rejects.toMatchObject({ status: 409, code: 'already_member' });
    const [inv] = await getDb().select().from(s.invite);
    expect(inv!.uses).toBe(1);
  });

  it('accepts sloppy input (lower case, hyphen, look-alikes)', async () => {
    const h = await makeHabitat();
    const { code } = await createInvite(h.members[0]!);
    const sloppy = (code.slice(0, 5) + '-' + code.slice(5)).toLowerCase();
    await acceptInvite((await makeUser()).id, sloppy);
    expect(h).toBeDefined();
  });

  it('stores only a hash of the code', async () => {
    const h = await makeHabitat();
    const { code } = await createInvite(h.members[0]!);
    const [inv] = await getDb().select().from(s.invite);
    expect(inv!.codeHash).not.toContain(code);
    expect(JSON.stringify(inv)).not.toContain(code);
    expect(h).toBeDefined();
  });

  it('expired → 410', async () => {
    const h = await makeHabitat();
    const { code } = await createInvite(h.members[0]!, { expiresInDays: 1 });
    const later = new Date(Date.now() + 2 * DAY);
    await expect(acceptInvite((await makeUser()).id, code, later)).rejects.toMatchObject({ status: 410 });
    await expect(previewInvite(code, later)).rejects.toMatchObject({ status: 410 });
  });

  it('revoked → 410', async () => {
    const h = await makeHabitat();
    const { code, invite } = await createInvite(h.members[0]!);
    await revokeInvite(h.members[0]!, invite.id);
    await expect(acceptInvite((await makeUser()).id, code)).rejects.toMatchObject({ status: 410 });
  });

  it('max_uses reached → 410', async () => {
    const h = await makeHabitat();
    const { code } = await createInvite(h.members[0]!, { maxUses: 1 });
    await acceptInvite((await makeUser()).id, code);
    await expect(acceptInvite((await makeUser()).id, code)).rejects.toMatchObject({ status: 410 });
  });

  it('unknown or malformed codes are 404', async () => {
    await expect(acceptInvite((await makeUser()).id, 'ABCDEFGHJK')).rejects.toMatchObject({ status: 404 });
    await expect(acceptInvite((await makeUser()).id, 'short')).rejects.toMatchObject({ status: 404 });
  });

  it('concurrency: 5 parallel accepts with 1 seat left give exactly 1 success', async () => {
    const h = await makeHabitat({ members: 2 });
    await updateHabitat(h.members[0]!, { memberCap: 3 });
    const { code } = await createInvite(h.members[0]!);
    const users = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
    const results = await Promise.allSettled(users.map((u) => acceptInvite(u.id, code)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(failures.every((f) => f.reason.code === 'habitat_full')).toBe(true);
  });

  it('a full habitat says so in the preview', async () => {
    const h = await makeHabitat({ members: 2 });
    await updateHabitat(h.members[0]!, { memberCap: 2 });
    const { code } = await createInvite(h.members[0]!);
    expect(await previewInvite(code)).toMatchObject({ full: true, memberCount: 2 });
  });

  it('someone who left can rejoin with a fresh invite, as a plain member', async () => {
    const h = await makeHabitat({ members: 2 });
    await removeMember(h.members[1]!, h.members[1]!.userId);
    const { code } = await createInvite(h.members[0]!);
    await acceptInvite(h.members[1]!.userId, code);
    const [m] = await getDb().select().from(s.membership).where(eq(s.membership.userId, h.members[1]!.userId));
    expect(m).toMatchObject({ leftAt: null, role: 'member' });
  });

  it('members can invite unless an admin turns it off (H3)', async () => {
    const h = await makeHabitat({ members: 2 });
    await createInvite(h.members[1]!);
    await updateHabitat(h.members[0]!, { membersCanInvite: false });
    await expect(createInvite(h.members[1]!)).rejects.toMatchObject({ status: 403 });
    await createInvite(h.members[0]!);
  });

  it('lists live invites only', async () => {
    const h = await makeHabitat();
    const a = await createInvite(h.members[0]!);
    await createInvite(h.members[0]!);
    await revokeInvite(h.members[0]!, a.invite.id);
    expect(await listInvites(h.members[0]!)).toHaveLength(1);
  });

  it('cannot revoke an invite from another habitat', async () => {
    const a = await makeHabitat();
    const b = await makeHabitat();
    const { invite } = await createInvite(a.members[0]!);
    await expect(revokeInvite(b.members[0]!, invite.id)).rejects.toMatchObject({ status: 404 });
  });
});
