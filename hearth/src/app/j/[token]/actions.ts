'use server';

import { redirect } from 'next/navigation';
import { run } from '@/lib/action';
import { clientIp } from '@/lib/ip';
import { acceptInvite } from '@/lib/invites';
import { enforce, LIMITS } from '@/lib/rate-limit';

export interface JoinState {
  error?: string;
}

export async function joinAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get('token') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  if (!displayName) return { error: 'Please tell us your first name.' };
  const ip = await clientIp();
  const result = await run(
    async ({ db, userId }) => {
      await enforce(db, `join:${token.slice(0, 12)}`, LIMITS.join.limit, LIMITS.join.windowMs);
      await enforce(db, `join:ip:${ip}`, LIMITS.join.limit, LIMITS.join.windowMs);
      return acceptInvite(db, token, userId, displayName);
    },
    { guest: true },
  );
  if (!result.ok) return { error: result.error };
  // Straight into the cards: the quicker they start, the more likely they finish.
  redirect(`/r/${result.data.projectId}/swipe?as=${result.data.participantId}`);
}
