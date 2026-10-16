import { habitatRoute } from '@/lib/api';
import { getTimeline } from '@/lib/timeline';

export const GET = habitatRoute<{ habitatId: string }>(async ({ url, member }) =>
  getTimeline(member, {
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
  }),
);
