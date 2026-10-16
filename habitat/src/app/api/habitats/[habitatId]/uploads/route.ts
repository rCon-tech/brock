import { habitatRoute, parseBody } from '@/lib/api';
import { createUploads } from '@/lib/media';
import { UploadBody } from '@/lib/validation';

export const POST = habitatRoute<{ habitatId: string }>(async ({ req, member }) => ({
  uploads: await createUploads(member, (await parseBody(req, UploadBody)).files),
}));
