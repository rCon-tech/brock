import { habitatRoute } from '@/lib/api';
import { listMembers } from '@/lib/members';

export const GET = habitatRoute<{ habitatId: string }>(async ({ member }) => ({
  members: await listMembers(member.habitatId),
}));
