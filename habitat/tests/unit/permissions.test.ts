import { describe, expect, it } from 'vitest';
import { can, canRemoveMember, canWriteRecord, isAtLeast } from '@/lib/permissions';
import type { CollectionDef } from '@/modules/sdk/types';

const def = (permissions?: CollectionDef['permissions']): CollectionDef => ({
  fields: {},
  permissions,
});

describe('can', () => {
  it('owner-only actions', () => {
    expect(can('owner', 'habitat.delete')).toBe(true);
    expect(can('admin', 'habitat.delete')).toBe(false);
    expect(can('admin', 'member.role')).toBe(false);
    expect(can('member', 'habitat.transfer')).toBe(false);
  });
  it('admin actions', () => {
    for (const a of [
      'habitat.update',
      'record.pin',
      'content.moderate',
      'invite.revoke',
    ] as const) {
      expect(can('admin', a)).toBe(true);
      expect(can('owner', a)).toBe(true);
      expect(can('member', a)).toBe(false);
    }
  });
  it('orders roles', () => {
    expect(isAtLeast('admin', 'member')).toBe(true);
    expect(isAtLeast('member', 'admin')).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('members can leave, the owner cannot', () => {
    expect(canRemoveMember('member', 'a', 'member', 'a')).toBe(true);
    expect(canRemoveMember('owner', 'a', 'owner', 'a')).toBe(false);
  });
  it('admins remove members only', () => {
    expect(canRemoveMember('admin', 'a', 'member', 'b')).toBe(true);
    expect(canRemoveMember('admin', 'a', 'admin', 'b')).toBe(false);
    expect(canRemoveMember('admin', 'a', 'owner', 'b')).toBe(false);
  });
  it('members cannot remove others', () => {
    expect(canRemoveMember('member', 'a', 'member', 'b')).toBe(false);
  });
  it('owner removes admins and members', () => {
    expect(canRemoveMember('owner', 'a', 'admin', 'b')).toBe(true);
  });
});

describe('canWriteRecord', () => {
  const me = { userId: 'me', role: 'member' as const };
  it('defaults: anyone creates, author updates, author-or-admin deletes', () => {
    expect(canWriteRecord(me, def(), 'create')).toBe(true);
    expect(canWriteRecord({ ...me, recordAuthorId: 'me' }, def(), 'update')).toBe(true);
    expect(canWriteRecord({ ...me, recordAuthorId: 'x' }, def(), 'update')).toBe(false);
    expect(canWriteRecord({ ...me, recordAuthorId: 'x' }, def(), 'delete')).toBe(false);
    expect(
      canWriteRecord({ userId: 'a', role: 'admin', recordAuthorId: 'x' }, def(), 'delete'),
    ).toBe(true);
  });
  it('admin-only create', () => {
    expect(canWriteRecord(me, def({ create: 'admin' }), 'create')).toBe(false);
    expect(canWriteRecord({ userId: 'a', role: 'admin' }, def({ create: 'admin' }), 'create')).toBe(
      true,
    );
  });
  it('a record with no author (former member) is not editable by members', () => {
    expect(canWriteRecord({ ...me, recordAuthorId: null }, def(), 'update')).toBe(false);
  });
  it('member scope lets anyone update (shared checklists)', () => {
    expect(
      canWriteRecord({ ...me, recordAuthorId: 'x' }, def({ update: 'member' }), 'update'),
    ).toBe(true);
  });
  it('update by admin scope', () => {
    expect(
      canWriteRecord({ ...me, recordAuthorId: 'me' }, def({ update: 'admin' }), 'update'),
    ).toBe(false);
    expect(
      canWriteRecord(
        { userId: 'o', role: 'owner', recordAuthorId: 'me' },
        def({ update: 'admin' }),
        'update',
      ),
    ).toBe(true);
  });
});
