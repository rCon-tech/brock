import { habitatRoute } from '@/lib/api';
import { setPinned } from '@/lib/interactions';

type P = { habitatId: string; recordId: string };

export const PUT = habitatRoute<P>(async ({ member, params }) => {
  await setPinned(member, params.recordId, true);
});

export const DELETE = habitatRoute<P>(async ({ member, params }) => {
  await setPinned(member, params.recordId, false);
});
