import { created, habitatRoute, parseBody } from '@/lib/api';
import { addComment, listComments } from '@/lib/interactions';
import { CommentBody } from '@/lib/validation';

type P = { habitatId: string; recordId: string };

export const GET = habitatRoute<P>(async ({ member, params }) => ({
  comments: await listComments(member, params.recordId),
}));

export const POST = habitatRoute<P>(async ({ req, member, params }) =>
  created({
    comment: await addComment(member, params.recordId, await parseBody(req, CommentBody)),
  }),
);
