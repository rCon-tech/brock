import { and, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { getDb, type Executor, type Tx } from '@/db';
import { habitat, installedModule, membership, proposal, proposalVote, user } from '@/db/schema';
import { getManifest } from '@/modules/registry';
import { compileFields } from '@/modules/sdk/fields';
import { conflict, DomainError, forbidden, invalid, isUniqueViolation, notFound } from './errors';
import { logAudit } from './audit';
import { decide, describeRule, type Decision, type GovernanceMode } from './governance';
import { install, uninstall } from './installed-modules';
import { activeMemberIds, notify } from './notifications';
import { publish } from './realtime';
import { can } from './permissions';
import type { MemberCtx } from './session';

type ProposalRow = typeof proposal.$inferSelect;

export interface ProposalDTO {
  id: string;
  kind: ProposalRow['kind'];
  moduleId: string | null;
  moduleName: string | null;
  payload: Record<string, unknown>;
  reason: string | null;
  proposedBy: { id: string; name: string } | null;
  status: ProposalRow['status'];
  closesAt: string;
  decidedAt: string | null;
  createdAt: string;
  yes: number;
  no: number;
  memberCount: number;
  myVote: 'yes' | 'no' | null;
  rule: string;
}

export interface ProposeInput {
  kind: ProposalRow['kind'];
  moduleId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
}

async function lockHabitat(tx: Executor, habitatId: string) {
  const [h] = await tx.select().from(habitat).where(eq(habitat.id, habitatId)).for('share');
  if (!h) throw notFound();
  return h;
}

/** Votes from current members only (people who left don't count, H7), and who the admin voters are. */
async function tally(tx: Executor, p: ProposalRow) {
  const rows = await tx
    .select({ vote: proposalVote.vote, role: membership.role, votedAt: proposalVote.votedAt })
    .from(proposalVote)
    .innerJoin(
      membership,
      and(
        eq(membership.userId, proposalVote.userId),
        eq(membership.habitatId, p.habitatId),
        isNull(membership.leftAt),
      ),
    )
    .where(eq(proposalVote.proposalId, p.id));
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(membership)
    .where(and(eq(membership.habitatId, p.habitatId), isNull(membership.leftAt)));
  const yes = rows.filter((r) => r.vote === 'yes').length;
  const no = rows.filter((r) => r.vote === 'no').length;
  const adminVotes = rows
    .filter((r) => r.role !== 'member')
    .sort((a, b) => a.votedAt.getTime() - b.votedAt.getTime());
  return {
    yes,
    no,
    memberCount: n,
    adminVote: (adminVotes[0]?.vote ?? null) as 'yes' | 'no' | null,
  };
}

/**
 * Decide an open proposal, and if it is decided, finish it in this transaction: apply the change,
 * notify members, write the audit log. Callers hold a row lock on the proposal.
 */
async function evaluate(
  tx: Tx,
  p: ProposalRow,
  mode: GovernanceMode,
  now: Date,
): Promise<Decision> {
  const t = await tally(tx, p);
  const decision = decide({ mode, ...t, closesAt: p.closesAt, now });
  if (decision === 'open') return decision;

  await tx.update(proposal).set({ status: decision, decidedAt: now }).where(eq(proposal.id, p.id));
  if (decision === 'passed') await applyPassed(tx, p);
  const members = await activeMemberIds(tx, p.habitatId);
  await notify(
    tx,
    members.map((userId) => ({
      userId,
      habitatId: p.habitatId,
      type: 'proposal.decided',
      proposalId: p.id,
      payload: { status: decision, kind: p.kind, moduleId: p.moduleId },
    })),
  );
  await logAudit(tx, p.habitatId, null, `proposal.${decision}`, {
    proposalId: p.id,
    kind: p.kind,
    moduleId: p.moduleId,
  });
  return decision;
}

async function applyPassed(tx: Tx, p: ProposalRow) {
  switch (p.kind) {
    case 'install':
      await install(tx, p.habitatId, p.moduleId!, { proposalId: p.id });
      break;
    case 'uninstall':
      await uninstall(tx, p.habitatId, p.moduleId!);
      break;
    case 'governance':
      await tx
        .update(habitat)
        .set({ governance: p.payload.mode as GovernanceMode })
        .where(eq(habitat.id, p.habitatId));
      break;
    case 'settings':
      await tx
        .update(installedModule)
        .set({ settings: (p.payload.settings ?? {}) as Record<string, unknown> })
        .where(
          and(
            eq(installedModule.habitatId, p.habitatId),
            eq(installedModule.moduleId, p.moduleId!),
          ),
        );
      break;
  }
}

async function validateProposal(tx: Tx, habitatId: string, input: ProposeInput) {
  const active = await tx
    .select({ id: installedModule.moduleId })
    .from(installedModule)
    .where(and(eq(installedModule.habitatId, habitatId), isNull(installedModule.removedAt)));
  const isActive = (id: string) => active.some((a) => a.id === id);

  switch (input.kind) {
    case 'install': {
      if (!input.moduleId || !getManifest(input.moduleId))
        throw notFound('There’s no such module.');
      if (isActive(input.moduleId))
        throw conflict('already_installed', 'That module is already installed.');
      return { payload: {} };
    }
    case 'uninstall': {
      if (!input.moduleId || !isActive(input.moduleId))
        throw conflict('not_installed', 'That module isn’t installed.');
      return { payload: {} };
    }
    case 'governance': {
      const mode = input.payload?.mode;
      if (mode !== 'majority' && mode !== 'unanimous' && mode !== 'admins')
        throw invalid('Choose a voting rule.');
      const [h] = await tx
        .select({ g: habitat.governance })
        .from(habitat)
        .where(eq(habitat.id, habitatId));
      if (h?.g === mode) throw conflict('no_change', 'That’s already the voting rule.');
      return { payload: { mode } };
    }
    case 'settings': {
      const m = input.moduleId ? getManifest(input.moduleId) : undefined;
      if (!m || !input.moduleId || !isActive(input.moduleId))
        throw conflict('not_installed', 'That module isn’t installed.');
      if (!m.settings) throw invalid('That module has no settings.');
      const parsed = compileFields(m.settings).safeParse(input.payload?.settings ?? {});
      if (!parsed.success) throw invalid('Those settings aren’t valid.');
      return { payload: { settings: parsed.data } };
    }
  }
}

export async function propose(
  ctx: MemberCtx,
  input: ProposeInput,
  now = new Date(),
): Promise<ProposalDTO> {
  const db = getDb();
  const id = await db
    .transaction(async (tx) => {
      const h = await lockHabitat(tx, ctx.habitatId);
      const { payload } = await validateProposal(tx, ctx.habitatId, input);
      const [p] = await tx
        .insert(proposal)
        .values({
          habitatId: ctx.habitatId,
          kind: input.kind,
          moduleId: input.moduleId ?? null,
          payload,
          reason: input.reason?.trim() || null,
          proposedBy: ctx.userId,
          closesAt: new Date(now.getTime() + h.voteWindowHours * 3600_000),
          createdAt: now,
        })
        .returning();
      await tx
        .insert(proposalVote)
        .values({ proposalId: p!.id, userId: ctx.userId, vote: 'yes', votedAt: now });
      const others = await activeMemberIds(tx, ctx.habitatId, ctx.userId);
      await notify(
        tx,
        others.map((userId) => ({
          userId,
          habitatId: ctx.habitatId,
          type: 'proposal.opened',
          actorId: ctx.userId,
          proposalId: p!.id,
          payload: { kind: input.kind, moduleId: input.moduleId ?? null },
        })),
      );
      await logAudit(tx, ctx.habitatId, ctx.userId, 'proposal.opened', {
        proposalId: p!.id,
        kind: input.kind,
        moduleId: input.moduleId,
      });
      await evaluate(tx, p!, h.governance, now);
      return p!.id;
    })
    .catch((e) => {
      if (isUniqueViolation(e)) {
        const name = (input.moduleId && getManifest(input.moduleId)?.name) || 'that';
        throw conflict('proposal_already_open', `There’s already a vote open for ${name}.`);
      }
      throw e;
    });
  const dto = await getProposal(db, ctx, id);
  if (dto.status !== 'open') await announce(ctx.habitatId, dto);
  return dto;
}

export async function vote(
  ctx: MemberCtx,
  proposalId: string,
  choice: 'yes' | 'no',
  now = new Date(),
): Promise<ProposalDTO> {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const h = await lockHabitat(tx, ctx.habitatId);
    const [p] = await tx
      .select()
      .from(proposal)
      .where(and(eq(proposal.id, proposalId), eq(proposal.habitatId, ctx.habitatId)))
      .for('update');
    if (!p) throw notFound();
    if (p.status !== 'open') throw conflict('proposal_closed', 'This vote has already finished.');
    if (now.getTime() >= p.closesAt.getTime()) {
      await evaluate(tx, p, h.governance, now);
      return { closedLate: true };
    }
    await tx
      .insert(proposalVote)
      .values({ proposalId, userId: ctx.userId, vote: choice, votedAt: now })
      .onConflictDoUpdate({
        target: [proposalVote.proposalId, proposalVote.userId],
        set: { vote: choice, votedAt: now },
      });
    await evaluate(tx, p, h.governance, now);
    return { closedLate: false };
  });
  if (result.closedLate) throw conflict('proposal_closed', 'This vote has already finished.');
  const dto = await getProposal(db, ctx, proposalId);
  if (dto.status !== 'open') await announce(ctx.habitatId, dto);
  return dto;
}

export async function withdraw(ctx: MemberCtx, proposalId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proposal)
      .where(and(eq(proposal.id, proposalId), eq(proposal.habitatId, ctx.habitatId)))
      .for('update');
    if (!p) throw notFound();
    if (p.proposedBy !== ctx.userId && !can(ctx.role, 'habitat.update')) throw forbidden();
    if (p.status !== 'open') throw conflict('proposal_closed', 'This vote has already finished.');
    await tx
      .update(proposal)
      .set({ status: 'withdrawn', decidedAt: new Date() })
      .where(eq(proposal.id, p.id));
    await logAudit(tx, ctx.habitatId, ctx.userId, 'proposal.withdrawn', { proposalId });
  });
}

/** Cron: close every proposal whose window has ended, applying the window-close rule (H7). */
export async function closeExpired(now = new Date()): Promise<number> {
  const db = getDb();
  const due = await db
    .select({ id: proposal.id, habitatId: proposal.habitatId })
    .from(proposal)
    .where(and(eq(proposal.status, 'open'), lte(proposal.closesAt, now)));
  let closed = 0;
  for (const d of due) {
    const status = await db.transaction(async (tx) => {
      const [p] = await tx.select().from(proposal).where(eq(proposal.id, d.id)).for('update');
      if (!p || p.status !== 'open') return null;
      const [h] = await tx.select().from(habitat).where(eq(habitat.id, d.habitatId));
      if (!h) return null;
      return evaluate(tx, p, h.governance, now);
    });
    if (status && status !== 'open') {
      closed++;
      await publish(d.habitatId, { type: 'proposal.decided', proposalId: d.id, status });
      await publish(d.habitatId, { type: 'modules.changed' });
    }
  }
  return closed;
}

/** After the membership changes the thresholds move, so re-run every open vote in the Habitat. */
export async function reevaluateOpen(tx: Tx, habitatId: string, now = new Date()): Promise<void> {
  const open = await tx
    .select()
    .from(proposal)
    .where(and(eq(proposal.habitatId, habitatId), eq(proposal.status, 'open')))
    .for('update');
  if (!open.length) return;
  const [h] = await tx.select().from(habitat).where(eq(habitat.id, habitatId));
  if (!h) return;
  for (const p of open) await evaluate(tx, p, h.governance, now);
}

async function announce(habitatId: string, dto: ProposalDTO) {
  await publish(habitatId, { type: 'proposal.decided', proposalId: dto.id, status: dto.status });
  await publish(habitatId, { type: 'modules.changed' });
}

async function toDTOs(db: Executor, ctx: MemberCtx, rows: ProposalRow[]): Promise<ProposalDTO[]> {
  if (!rows.length) return [];
  const [h] = await db.select().from(habitat).where(eq(habitat.id, ctx.habitatId));
  const ids = rows.map((r) => r.id);
  const votes = await db
    .select({
      proposalId: proposalVote.proposalId,
      userId: proposalVote.userId,
      vote: proposalVote.vote,
    })
    .from(proposalVote)
    .innerJoin(
      membership,
      and(
        eq(membership.userId, proposalVote.userId),
        eq(membership.habitatId, ctx.habitatId),
        isNull(membership.leftAt),
      ),
    )
    .where(inArray(proposalVote.proposalId, ids));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(membership)
    .where(and(eq(membership.habitatId, ctx.habitatId), isNull(membership.leftAt)));
  const proposerIds = [...new Set(rows.map((r) => r.proposedBy).filter((x): x is string => !!x))];
  const people = proposerIds.length
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, proposerIds))
    : [];
  return rows.map((p) => {
    const mine = votes.filter((v) => v.proposalId === p.id);
    return {
      id: p.id,
      kind: p.kind,
      moduleId: p.moduleId,
      moduleName: (p.moduleId && getManifest(p.moduleId)?.name) || null,
      payload: p.payload,
      reason: p.reason,
      proposedBy: p.proposedBy ? (people.find((u) => u.id === p.proposedBy) ?? null) : null,
      status: p.status,
      closesAt: p.closesAt.toISOString(),
      decidedAt: p.decidedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      yes: mine.filter((v) => v.vote === 'yes').length,
      no: mine.filter((v) => v.vote === 'no').length,
      memberCount: n,
      myVote: mine.find((v) => v.userId === ctx.userId)?.vote ?? null,
      rule: describeRule(h!.governance, n),
    };
  });
}

export async function getProposal(
  db: Executor,
  ctx: MemberCtx,
  proposalId: string,
): Promise<ProposalDTO> {
  const [p] = await db
    .select()
    .from(proposal)
    .where(and(eq(proposal.id, proposalId), eq(proposal.habitatId, ctx.habitatId)));
  if (!p) throw new DomainError('not_found', 404, 'Not found.');
  return (await toDTOs(db, ctx, [p]))[0]!;
}

export async function listProposals(
  ctx: MemberCtx,
  opts: { status?: 'open' | 'closed' } = {},
): Promise<ProposalDTO[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(proposal)
    .where(
      and(
        eq(proposal.habitatId, ctx.habitatId),
        opts.status === 'open'
          ? eq(proposal.status, 'open')
          : opts.status === 'closed'
            ? inArray(proposal.status, ['passed', 'rejected', 'withdrawn'])
            : undefined,
      ),
    )
    .orderBy(desc(proposal.createdAt))
    .limit(100);
  return toDTOs(db, ctx, rows);
}

/** Open votes by module, for the Library cards ("Vote open: 3/5 yes"). */
export async function openProposalsByModule(ctx: MemberCtx): Promise<Map<string, ProposalDTO>> {
  const open = await listProposals(ctx, { status: 'open' });
  return new Map(open.filter((p) => p.moduleId).map((p) => [p.moduleId!, p]));
}
