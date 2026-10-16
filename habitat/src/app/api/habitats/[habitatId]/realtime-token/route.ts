import { habitatRoute, json } from '@/lib/api';
import { createTokenRequest } from '@/lib/realtime';

/** 204 when realtime isn't configured: clients then poll. */
export const GET = habitatRoute<{ habitatId: string }>(async ({ member, user }) => {
  const req = await createTokenRequest(member.habitatId, user.id);
  return req ? json(req) : new Response(null, { status: 204 });
});
