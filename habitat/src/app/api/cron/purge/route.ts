import { cronRoute } from '@/lib/cron';
import { purgeRemoved } from '@/lib/installed-modules';
import { purgePendingMedia } from '@/lib/media';

export const GET = cronRoute(async () => {
  const removed = await purgeRemoved();
  const media = await purgePendingMedia();
  return { ...removed, media };
});
