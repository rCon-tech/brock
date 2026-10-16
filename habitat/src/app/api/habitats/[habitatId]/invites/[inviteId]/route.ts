import { habitatRoute } from '@/lib/api';
import { revokeInvite } from '@/lib/invites';

export const DELETE = habitatRoute<{ habitatId: string; inviteId: string }>(async ({ member, params }) => {
  await revokeInvite(member, params.inviteId);
});
