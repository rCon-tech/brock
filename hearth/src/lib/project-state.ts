import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { bridgeRound, participant, project } from '@/db/schema';
import type { Db } from '@/db';
import { NotFound } from '@/lib/errors';
import { isFinished, latestSynthesis } from '@/lib/synthesis';

export interface ProjectState {
  /** Changes whenever anything a waiting screen shows has changed. */
  signature: string;
  revealed: boolean;
  people: { id: string; name: string; finished: boolean; ready: boolean }[];
  boardVersion: number;
  namingReady: boolean;
}

/** The small payload polled by the hub, reveal and board screens (R18). */
export async function getProjectState(db: Db, projectId: string): Promise<ProjectState> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) throw new NotFound();
  const people = await db.select().from(participant).where(eq(participant.projectId, projectId));
  const latest = proj.revealedAt ? await latestSynthesis(db, projectId) : null;
  const rounds = await db
    .select({ id: bridgeRound.id })
    .from(bridgeRound)
    .where(eq(bridgeRound.projectId, projectId));
  const state = {
    revealed: !!proj.revealedAt,
    people: people.map((p) => ({
      id: p.id,
      name: p.displayName,
      finished: isFinished(p),
      ready: !!p.readyAt,
      macro: !!p.macroDoneAt,
    })),
    boardVersion: latest?.version ?? 0,
    namingReady: latest?.status === 'ready',
    rounds: rounds.length,
  };
  return {
    signature: createHash('sha1').update(JSON.stringify(state)).digest('hex').slice(0, 16),
    revealed: state.revealed,
    people: state.people.map(({ id, name, finished, ready }) => ({ id, name, finished, ready })),
    boardVersion: state.boardVersion,
    namingReady: state.namingReady,
  };
}
