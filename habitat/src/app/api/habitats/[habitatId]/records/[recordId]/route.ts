import { habitatRoute, parseBody } from '@/lib/api';
import { deleteRecord, getRecord, updateRecord } from '@/lib/records';
import { RecordPatchBody } from '@/lib/validation';

type P = { habitatId: string; recordId: string };

export const GET = habitatRoute<P>(async ({ member, params }) => ({
  record: await getRecord(member, params.recordId),
}));

export const PATCH = habitatRoute<P>(async ({ req, member, params }) => ({
  record: await updateRecord(member, params.recordId, (await parseBody(req, RecordPatchBody)).data),
}));

export const DELETE = habitatRoute<P>(async ({ member, params }) => {
  await deleteRecord(member, params.recordId);
});
