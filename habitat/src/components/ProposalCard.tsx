'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/RelativeTime';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { ProposalDTO } from '@/lib/proposals';
import { useHabitat } from '@/modules/sdk/context';

export function proposalTitle(p: Pick<ProposalDTO, 'kind' | 'moduleName' | 'payload'>) {
  switch (p.kind) {
    case 'install':
      return `Add ${p.moduleName ?? 'a module'}`;
    case 'uninstall':
      return `Remove ${p.moduleName ?? 'a module'}`;
    case 'governance':
      return `Change how votes work to “${String(p.payload.mode)}”`;
    case 'settings':
      return `Change ${p.moduleName ?? 'module'} settings`;
  }
}

export function ProposalCard({ p }: { p: ProposalDTO }) {
  const { habitatId, me } = useHabitat();
  const qc = useQueryClient();
  const router = useRouter();
  const open = p.status === 'open';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['habitat', habitatId] });
    router.refresh();
    window.dispatchEvent(new Event('habitat:modules-changed'));
  };
  const cast = useMutation({
    mutationFn: (vote: 'yes' | 'no') =>
      apiFetch<{ proposal: ProposalDTO }>(`/api/habitats/${habitatId}/proposals/${p.id}/vote`, {
        method: 'PUT',
        body: { vote },
      }),
    onSuccess: ({ proposal }) => {
      if (proposal.status === 'passed') toast.success('It passed! 🎉');
      else if (proposal.status === 'rejected') toast('That vote didn’t pass.');
      refresh();
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      refresh();
    },
  });
  const withdraw = useMutation({
    mutationFn: () =>
      apiFetch(`/api/habitats/${habitatId}/proposals/${p.id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const yesPct = p.memberCount ? (p.yes / p.memberCount) * 100 : 0;
  const noPct = p.memberCount ? (p.no / p.memberCount) * 100 : 0;
  const tone = p.status === 'passed' ? 'ok' : p.status === 'open' ? 'accent' : 'neutral';

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{proposalTitle(p)}</h3>
          <p className="text-sm text-ink-soft">
            Proposed by {p.proposedBy?.name ?? 'a former member'} ·{' '}
            <RelativeTime iso={p.createdAt} />
          </p>
        </div>
        <Badge tone={tone}>{open ? 'Open' : p.status}</Badge>
      </div>
      {p.reason && <p className="rounded-xl bg-surface-2 p-3 text-sm">“{p.reason}”</p>}

      <div>
        <div
          className="flex h-3 overflow-hidden rounded-full bg-surface-2"
          role="img"
          aria-label={`${p.yes} yes, ${p.no} no, of ${p.memberCount} members`}
        >
          <div className="bg-ok" style={{ width: `${yesPct}%` }} />
          <div className="bg-danger" style={{ width: `${noPct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-soft">
          <span>
            {p.yes} yes · {p.no} no · {p.memberCount - p.yes - p.no} yet to vote
          </span>
          {open && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> closes <RelativeTime iso={p.closesAt} />
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-soft">{p.rule}</p>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={p.myVote === 'yes' ? 'primary' : 'outline'}
            onClick={() => cast.mutate('yes')}
            disabled={cast.isPending}
            aria-pressed={p.myVote === 'yes'}
          >
            <Check size={16} /> Yes
          </Button>
          <Button
            variant={p.myVote === 'no' ? 'danger' : 'outline'}
            onClick={() => cast.mutate('no')}
            disabled={cast.isPending}
            aria-pressed={p.myVote === 'no'}
          >
            <X size={16} /> No
          </Button>
          {(p.proposedBy?.id === me.id || me.role !== 'member') && (
            <Button variant="ghost" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
              Withdraw
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
