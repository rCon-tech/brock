import { created, habitatRoute, parseBody } from '@/lib/api';
import { listProposals, propose } from '@/lib/proposals';
import { ProposeBody } from '@/lib/validation';

type P = { habitatId: string };

export const GET = habitatRoute<P>(async ({ url, member }) => {
  const status = url.searchParams.get('status');
  return {
    proposals: await listProposals(member, {
      status: status === 'open' || status === 'closed' ? status : undefined,
    }),
  };
});

export const POST = habitatRoute<P>(async ({ req, member }) =>
  created({ proposal: await propose(member, await parseBody(req, ProposeBody)) }),
);
