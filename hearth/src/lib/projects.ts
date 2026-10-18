import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { participant, project, synthesis } from '@/db/schema';
import type { Db } from '@/db';
import { loadCentroids, loadEngineItems, loadUninformativeIds } from '@/lib/catalogue/load';
import { EMPTY_CONTEXT, projectContextSchema } from '@/lib/context';
import { buildDecks } from '@/lib/engine/deck';
import { AppError, Forbidden } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { createInvite } from '@/lib/invites';
import { BUDGET_BANDS, ROOM_TYPES } from '@/lib/taxonomy';

export const createProjectInput = z.object({
  roomType: z.enum(ROOM_TYPES),
  name: z.string().trim().max(60).optional(),
  budgetBand: z.enum(BUDGET_BANDS).nullish(),
  context: projectContextSchema.default(EMPTY_CONTEXT),
  mode: z.enum(['remote', 'together_devices', 'together_one_device']).default('remote'),
  displayName: z.string().trim().min(1).max(40),
  isQuiz: z.boolean().default(false),
  refPartner: z.string().max(60).optional(),
});
export type CreateProjectInput = z.input<typeof createProjectInput>;

export interface CreatedProject {
  projectId: string;
  participantId: string;
  inviteToken: string;
}

interface Extra {
  previousProjectId?: string;
  /** Extra people carried over from a previous room (R24). */
  carryOver?: { userId: string | null; hostUserId: string; displayName: string }[];
}

export async function createProject(
  db: Db,
  userId: string,
  rawInput: CreateProjectInput,
  extra: Extra = {},
): Promise<CreatedProject> {
  const input = createProjectInput.parse(rawInput);
  const items = await loadEngineItems(db, input.roomType);
  const excludeIds = await loadUninformativeIds(db);

  let nearVector: number[] | null = null;
  if (extra.previousProjectId) {
    const [prev] = await db
      .select({ style: synthesis.bridgeName, result: synthesis.result })
      .from(synthesis)
      .where(eq(synthesis.projectId, extra.previousProjectId))
      .orderBy(desc(synthesis.version))
      .limit(1);
    const slug = prev?.result?.bridgeStyle;
    if (slug)
      nearVector = (await loadCentroids(db, items)).find((c) => c.slug === slug)?.vector ?? null;
  }

  const seed = newId(12);
  const decks = buildDecks({
    roomType: input.roomType,
    items,
    context: input.context,
    budgetBand: input.budgetBand ?? null,
    seed,
    excludeIds,
    nearVector,
  });
  if (decks.macro.length === 0 || decks.micro.length === 0) {
    throw new AppError("We don't have enough cards for that room yet. Try another room.");
  }

  const projectId = newId();
  const participantId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(project).values({
      id: projectId,
      roomType: input.roomType,
      name: input.name || null,
      budgetBand: input.budgetBand ?? null,
      context: input.context,
      mode: input.mode,
      isQuiz: input.isQuiz,
      createdBy: userId,
      previousProjectId: extra.previousProjectId ?? null,
      refPartner: input.refPartner ?? null,
      macroDeck: decks.macro,
      microDeck: decks.micro,
      reserveMacro: decks.reserveMacro,
      reserveMicro: decks.reserveMicro,
      deckSeed: seed,
    });
    await tx.insert(participant).values({
      id: participantId,
      projectId,
      userId,
      hostUserId: userId,
      displayName: input.displayName,
      role: 'creator',
    });
    for (const other of extra.carryOver ?? []) {
      await tx.insert(participant).values({
        id: newId(),
        projectId,
        userId: other.userId,
        hostUserId: other.hostUserId,
        displayName: other.displayName,
        role: 'partner',
      });
    }
  });
  const inviteToken = await createInvite(db, projectId);
  return { projectId, participantId, inviteToken };
}

/** "Do the bedroom next" (R24): same people already joined, household context copied. */
export async function createNextRoom(
  db: Db,
  userId: string,
  previousProjectId: string,
  roomType: (typeof ROOM_TYPES)[number],
): Promise<CreatedProject> {
  const [prev] = await db.select().from(project).where(eq(project.id, previousProjectId));
  if (!prev || prev.createdBy !== userId) throw new Forbidden();
  const people = await db
    .select()
    .from(participant)
    .where(eq(participant.projectId, previousProjectId));
  const me = people.find((p) => p.hostUserId === userId && p.role === 'creator');
  if (!me) throw new Forbidden();
  return createProject(
    db,
    userId,
    {
      roomType,
      budgetBand: prev.budgetBand,
      // Who lives there carries over; what's staying and tight spaces are specific to a room.
      context: { ...EMPTY_CONTEXT, household: prev.context.household },
      mode: prev.mode,
      displayName: me.displayName,
    },
    {
      previousProjectId,
      carryOver: people
        .filter((p) => p.id !== me.id)
        .map((p) => ({ userId: p.userId, hostUserId: p.hostUserId, displayName: p.displayName })),
    },
  );
}

export async function listProjects(db: Db, userId: string) {
  const mine = await db
    .select({ projectId: participant.projectId })
    .from(participant)
    .where(eq(participant.hostUserId, userId));
  const ids = [...new Set(mine.map((m) => m.projectId))];
  if (ids.length === 0) return [];
  const projects = await db
    .select()
    .from(project)
    .where(inArray(project.id, ids))
    .orderBy(desc(project.createdAt));
  const people = await db.select().from(participant).where(inArray(participant.projectId, ids));
  return projects.map((p) => ({
    ...p,
    participants: people.filter((x) => x.projectId === p.id),
  }));
}

/** Before the reveal, anyone can edit the room context (R14–R16). */
export async function updateContext(
  db: Db,
  projectId: string,
  context: z.input<typeof projectContextSchema>,
): Promise<void> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new AppError('Not found', 404);
  if (proj.revealedAt)
    throw new AppError('The board is already out, so the room details are locked.');
  await db
    .update(project)
    .set({ context: projectContextSchema.parse(context) })
    .where(eq(project.id, projectId));
}

export async function deleteProject(db: Db, projectId: string): Promise<void> {
  await db.delete(project).where(eq(project.id, projectId));
}

export async function projectParticipants(db: Db, projectId: string) {
  return db
    .select()
    .from(participant)
    .where(eq(participant.projectId, projectId))
    .orderBy(participant.joinedAt);
}
