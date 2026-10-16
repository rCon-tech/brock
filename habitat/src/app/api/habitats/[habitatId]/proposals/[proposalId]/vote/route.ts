import { habitatRoute, parseBody } from '@/lib/api';
import { vote } from '@/lib/proposals';
import { VoteBody } from '@/lib/validation';

export const PUT = habitatRoute<{ habitatId: string; proposalId: string }>(async ({ req, member, params }) => {
  const proposal = await vote(member, params.proposalId, (await parseBody(req, VoteBody)).vote);
  return { proposal, status: proposal.status };
});
