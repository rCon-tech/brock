import { habitatRoute, parseBody } from '@/lib/api';
import { addReaction, removeReaction } from '@/lib/interactions';
import { ReactionBody } from '@/lib/validation';

type P = { habitatId: string; recordId: string };

export const PUT = habitatRoute<P>(async ({ req, member, params }) => {
  await addReaction(member, params.recordId, (await parseBody(req, ReactionBody)).emoji);
});

export const DELETE = habitatRoute<P>(async ({ req, member, params }) => {
  await removeReaction(member, params.recordId, (await parseBody(req, ReactionBody)).emoji);
});
