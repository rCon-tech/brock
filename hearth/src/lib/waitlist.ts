import { z } from 'zod';
import { waitlist } from '@/db/schema';
import type { Db } from '@/db';
import { newId } from '@/lib/ids';

export const waitlistInput = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(200),
  feature: z.enum(['see_in_room', 'designers']),
  projectId: z.string().max(64).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Interest in features that don't exist yet (§5). Never takes payment details. */
export async function joinWaitlist(db: Db, raw: z.input<typeof waitlistInput>): Promise<void> {
  const input = waitlistInput.parse(raw);
  await db.insert(waitlist).values({
    id: newId(),
    email: input.email,
    feature: input.feature,
    projectId: input.projectId ?? null,
    details: input.details ?? null,
  });
}
