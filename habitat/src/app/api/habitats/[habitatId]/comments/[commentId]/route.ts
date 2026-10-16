import { habitatRoute, parseBody } from '@/lib/api';
import { deleteComment, editComment } from '@/lib/interactions';
import { CommentPatchBody } from '@/lib/validation';

type P = { habitatId: string; commentId: string };

export const PATCH = habitatRoute<P>(async ({ req, member, params }) => {
  await editComment(member, params.commentId, (await parseBody(req, CommentPatchBody)).body);
});

export const DELETE = habitatRoute<P>(async ({ member, params }) => {
  await deleteComment(member, params.commentId);
});
