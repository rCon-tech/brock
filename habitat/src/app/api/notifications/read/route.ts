import { parseBody, userRoute } from '@/lib/api';
import { markRead } from '@/lib/notifications';
import { MarkReadBody } from '@/lib/validation';

export const POST = userRoute(async ({ req, user }) => {
  await markRead(user.id, (await parseBody(req, MarkReadBody)).ids);
});
