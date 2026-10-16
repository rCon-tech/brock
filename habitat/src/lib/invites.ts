import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { habitat, invite, membership } from '@/db/schema';
import { conflict, forbidden, gone, notFound } from './errors';
import { logAudit } from './audit';
import { hashCode, isValidCode, newCode, normalise } from './invite-code';
import { can } from './permissions';
import type { MemberCtx } from './session';

export const DEFAULT_INVITE_DAYS = 7;

export async function createInvite(
  ctx: MemberCtx,
  opts: { expiresInDays?: number; maxUses?: number | null } = {},
  now = new Date(),
) {
  const db = getDb();
  const [h] = await db.select().from(habitat).where(eq(habitat.id, ctx.habitatId));
  if (!h) throw notFound();
  if (!h.membersCanInvite && !can(ctx.role, 'habitat.update')) {
    throw forbidden('Only admins can invite people to this Habitat.');
  }
  const code = newCode();
  const days = opts.expiresInDays ?? DEFAULT_INVITE_DAYS;
  const [row] = await db
    .insert(invite)
    .values({
      habitatId: ctx.habitatId,
      codeHash: hashCode(code),
      createdBy: ctx.userId,
      expiresAt: new Date(now.getTime() + days * 86400_000),
      maxUses: opts.maxUses ?? null,
    })
    .returning();
  await logAudit(db, ctx.habitatId, ctx.userId, 'invite.created', { inviteId: row!.id });
  // The code is returned once; only its hash is stored.
  return { code, invite: row! };
}

export async function listInvites(ctx: MemberCtx, now = new Date()) {
  const rows = await getDb().select().from(invite).where(eq(invite.habitatId, ctx.habitatId));
  return rows
    .filter((i) => !i.revokedAt && i.expiresAt > now && (i.maxUses === null || i.uses < i.maxUses))
    .filter((i) => can(ctx.role, 'invite.revoke') || i.createdBy === ctx.userId)
    .map((i) => ({
      id: i.id,
      createdBy: i.createdBy,
      expiresAt: i.expiresAt.toISOString(),
      maxUses: i.maxUses,
      uses: i.uses,
    }));
}

export async function revokeInvite(ctx: MemberCtx, inviteId: string, now = new Date()) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(invite)
    .where(and(eq(invite.id, inviteId), eq(invite.habitatId, ctx.habitatId)));
  if (!row) throw notFound();
  if (row.createdBy !== ctx.userId && !can(ctx.role, 'invite.revoke')) throw forbidden();
  await db.update(invite).set({ revokedAt: now }).where(eq(invite.id, inviteId));
  await logAudit(db, ctx.habitatId, ctx.userId, 'invite.revoked', { inviteId });
}

type InviteState = 'ok' | 'expired' | 'revoked' | 'used_up';

function stateOf(i: typeof invite.$inferSelect, now: Date): InviteState {
  if (i.revokedAt) return 'revoked';
  if (i.expiresAt <= now) return 'expired';
  if (i.maxUses !== null && i.uses >= i.maxUses) return 'used_up';
  return 'ok';
}

const GONE_MESSAGE = 'This invite link has expired or been turned off. Ask for a new one.';

/** What the join page shows before you accept: only the bare minimum, and only for a live invite. */
export async function previewInvite(rawCode: string, now = new Date()) {
  const code = normalise(rawCode);
  if (!isValidCode(code)) throw notFound();
  const db = getDb();
  const [row] = await db
    .select({ i: invite, h: habitat })
    .from(invite)
    .innerJoin(habitat, eq(habitat.id, invite.habitatId))
    .where(and(eq(invite.codeHash, hashCode(code)), isNull(habitat.deletedAt)));
  if (!row) throw notFound();
  if (stateOf(row.i, now) !== 'ok') throw gone('invite_expired', GONE_MESSAGE);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(membership)
    .where(and(eq(membership.habitatId, row.h.id), isNull(membership.leftAt)));
  return {
    name: row.h.name,
    emoji: row.h.emoji,
    accent: row.h.accent,
    memberCount: n,
    full: n >= row.h.memberCap,
  };
}

/**
 * Accept an invite. The invite row and the Habitat row are locked, so five people racing for
 * the last seat produce exactly one success.
 */
export async function acceptInvite(userId: string, rawCode: string, now = new Date()) {
  const code = normalise(rawCode);
  if (!isValidCode(code)) throw notFound();
  return getDb().transaction(async (tx) => {
    const [inv] = await tx.select().from(invite).where(eq(invite.codeHash, hashCode(code))).for('update');
    if (!inv) throw notFound();
    const [h] = await tx.select().from(habitat).where(eq(habitat.id, inv.habitatId)).for('update');
    if (!h || h.deletedAt) throw notFound();
    if (stateOf(inv, now) !== 'ok') throw gone('invite_expired', GONE_MESSAGE);

    const [existing] = await tx
      .select()
      .from(membership)
      .where(and(eq(membership.habitatId, h.id), eq(membership.userId, userId)));
    if (existing && !existing.leftAt) throw conflict('already_member', 'You’re already in this Habitat.');

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(membership)
      .where(and(eq(membership.habitatId, h.id), isNull(membership.leftAt)));
    if (n >= h.memberCap) throw conflict('habitat_full', 'This Habitat is full.');

    if (existing) {
      await tx
        .update(membership)
        .set({ leftAt: null, role: 'member', joinedAt: now })
        .where(and(eq(membership.habitatId, h.id), eq(membership.userId, userId)));
    } else {
      await tx.insert(membership).values({ habitatId: h.id, userId, role: 'member', joinedAt: now });
    }
    await tx
      .update(invite)
      .set({ uses: sql`${invite.uses} + 1` })
      .where(eq(invite.id, inv.id));
    await logAudit(tx, h.id, userId, 'member.joined', { inviteId: inv.id });
    return { slug: h.slug, habitatId: h.id };
  });
}
