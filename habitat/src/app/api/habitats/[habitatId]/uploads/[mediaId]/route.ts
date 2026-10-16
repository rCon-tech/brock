import { habitatRoute } from '@/lib/api';
import { completeUpload } from '@/lib/media';

export const POST = habitatRoute<{ habitatId: string; mediaId: string }>(
  async ({ member, params }) => {
    await completeUpload(member, params.mediaId);
  },
);
