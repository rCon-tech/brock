import { getDb } from '@/db';
import { habitatRoute } from '@/lib/api';
import { getProposal, withdraw } from '@/lib/proposals';

type P = { habitatId: string; proposalId: string };

export const GET = habitatRoute<P>(async ({ member, params }) => ({
  proposal: await getProposal(getDb(), member, params.proposalId),
}));

export const DELETE = habitatRoute<P>(async ({ member, params }) => {
  await withdraw(member, params.proposalId);
});
