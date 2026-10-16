import { clientIp, publicRoute, userRoute } from '@/lib/api';
import { acceptInvite, previewInvite } from '@/lib/invites';
import { rateLimit } from '@/lib/rate-limit';

type P = { code: string };

/** Preview works signed out, so the join page can show what you're joining. Throttled per IP. */
export const GET = publicRoute<P>(async ({ req, params }) => {
  await rateLimit(`invite-preview:${clientIp(req)}`, 30, 3600);
  return previewInvite(params.code);
});

export const POST = userRoute<P>(async ({ req, user, params }) => {
  await rateLimit(`invite-accept:${clientIp(req)}`, 10, 3600);
  const { slug } = await acceptInvite(user.id, params.code);
  return { slug };
});
