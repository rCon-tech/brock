import { auditLog } from '@/db/schema';
import type { Executor } from '@/db';

export async function logAudit(
  db: Executor,
  habitatId: string,
  actorId: string | null,
  action: string,
  details: Record<string, unknown> = {},
) {
  await db.insert(auditLog).values({ habitatId, actorId, action, details });
}
