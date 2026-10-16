import type { CollectionDef } from '@/modules/sdk/types';

export type Role = 'owner' | 'admin' | 'member';

export type Action =
  | 'habitat.update'
  | 'habitat.delete'
  | 'habitat.transfer'
  | 'member.remove'
  | 'member.role'
  | 'invite.revoke'
  | 'record.pin'
  | 'content.moderate'
  | 'report.view'
  | 'module.settings';

const ADMIN_ACTIONS: ReadonlySet<Action> = new Set([
  'habitat.update',
  'member.remove',
  'invite.revoke',
  'record.pin',
  'content.moderate',
  'report.view',
  'module.settings',
]);

const OWNER_ACTIONS: ReadonlySet<Action> = new Set([
  'habitat.delete',
  'habitat.transfer',
  'member.role',
]);

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export function isAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** H4 role matrix. */
export function can(role: Role, action: Action): boolean {
  if (OWNER_ACTIONS.has(action)) return role === 'owner';
  if (ADMIN_ACTIONS.has(action)) return role === 'owner' || role === 'admin';
  return false;
}

/** May `actor` remove `target`? Admins cannot remove other admins or the owner. */
export function canRemoveMember(
  actorRole: Role,
  actorId: string,
  targetRole: Role,
  targetId: string,
): boolean {
  if (actorId === targetId) return targetRole !== 'owner'; // leaving; the owner must transfer first
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole === 'member';
}

export type WriteOp = 'create' | 'update' | 'delete';

export interface WriteContext {
  userId: string;
  role: Role;
  /** For `update`/`delete`: who wrote the record being changed. */
  recordAuthorId?: string | null;
}

/** §5.3 point 2. Defaults: create=member, update=author, delete=author-or-admin. */
export function canWriteRecord(ctx: WriteContext, def: CollectionDef, op: WriteOp): boolean {
  const isAdmin = ctx.role === 'owner' || ctx.role === 'admin';
  if (op === 'create') {
    return (def.permissions?.create ?? 'member') === 'admin' ? isAdmin : true;
  }
  const scope = def.permissions?.[op] ?? (op === 'update' ? 'author' : 'author-or-admin');
  if (scope === 'member') return true;
  const isAuthor = !!ctx.recordAuthorId && ctx.recordAuthorId === ctx.userId;
  if (scope === 'author') return isAuthor;
  if (scope === 'admin') return isAdmin;
  return isAuthor || isAdmin;
}
