import { exportMyData } from '@/lib/account';
import { json, userRoute } from '@/lib/api';

export const GET = userRoute(async ({ user }) =>
  json(await exportMyData(user.id), 200, {
    headers: { 'Content-Disposition': 'attachment; filename="habitat-export.json"' },
  }),
);
