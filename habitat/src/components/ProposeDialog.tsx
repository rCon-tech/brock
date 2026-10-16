'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label, Textarea } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { ProposalDTO } from '@/lib/proposals';
import { useHabitat } from '@/modules/sdk/context';

export function ProposeDialog({
  kind,
  moduleId,
  moduleName,
  trigger,
}: {
  kind: 'install' | 'uninstall';
  moduleId: string;
  moduleName: string;
  trigger: ReactNode;
}) {
  const { habitatId, members } = useHabitat();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const verb = kind === 'install' ? 'add' : 'remove';

  const propose = useMutation({
    mutationFn: () =>
      apiFetch<{ proposal: ProposalDTO }>(`/api/habitats/${habitatId}/proposals`, {
        method: 'POST',
        body: { kind, moduleId, reason: reason.trim() || undefined },
      }),
    onSuccess: ({ proposal }) => {
      setOpen(false);
      setReason('');
      toast.success(
        proposal.status === 'passed'
          ? `${moduleName} ${kind === 'install' ? 'added' : 'removed'}`
          : 'Vote started. Your friends have been told.',
      );
      qc.invalidateQueries({ queryKey: ['habitat', habitatId] });
      router.refresh();
      window.dispatchEvent(new Event('habitat:modules-changed'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={`${kind === 'install' ? 'Add' : 'Remove'} ${moduleName}?`}
        description={
          members.length > 1
            ? `This starts a vote. Everyone in the Habitat can say yes or no.${kind === 'uninstall' ? ' Its content is hidden, not deleted, for 30 days.' : ''}`
            : `You’re the only member, so this happens straight away.${kind === 'uninstall' ? ' Its content is hidden, not deleted, for 30 days.' : ''}`
        }
      >
        <Label htmlFor="reason">Why should we {verb} it? (optional)</Label>
        <Textarea
          id="reason"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="So we can finally settle where to eat…"
        />
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => propose.mutate()} disabled={propose.isPending}>
            {members.length > 1 ? 'Start vote' : `${kind === 'install' ? 'Add' : 'Remove'} it`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
