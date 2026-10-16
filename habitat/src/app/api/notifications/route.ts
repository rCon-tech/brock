import { userRoute } from '@/lib/api';
import { listNotifications } from '@/lib/notifications';

export const GET = userRoute(async ({ url, user }) =>
  listNotifications(user.id, {
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
  }),
);
