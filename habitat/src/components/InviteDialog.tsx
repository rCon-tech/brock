'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, Mail, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { useHabitat } from '@/modules/sdk/context';
import { RelativeTime } from '@/components/RelativeTime';

interface InviteRow {
  id: string;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
}

export function InviteDialog({ canInvite }: { canInvite: boolean }) {
  const { habitatId, name } = useHabitat();
  const qc = useQueryClient();
  const [fresh, setFresh] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');

  const { data } = useQuery({
    queryKey: ['habitat', habitatId, 'invites'],
    queryFn: () => apiFetch<{ invites: InviteRow[] }>(`/api/habitats/${habitatId}/invites`),
    enabled: canInvite,
  });

  const create = useMutation({
    mutationFn: (body: { email?: string }) =>
      apiFetch<{ url: string; emailed: boolean }>(`/api/habitats/${habitatId}/invites`, { method: 'POST', body }),
    onSuccess: (r) => {
      setFresh({ url: r.url });
      if (r.emailed) toast.success('Invite sent');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'invites'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/habitats/${habitatId}/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'invites'] }),
  });

  if (!canInvite) return null;

  async function copy() {
    await navigator.clipboard.writeText(fresh!.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog onOpenChange={(o) => !o && setFresh(null)}>
      <DialogTrigger asChild>
        <Button>
          <Link2 size={16} /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent title="Invite people" description={`Anyone with the link can join ${name}. Only share it with people you trust.`}>
        <div className="space-y-4">
          {fresh ? (
            <div className="space-y-2">
              <Label htmlFor="link">Your new link (shown once)</Label>
              <div className="flex gap-2">
                <Input id="link" readOnly value={fresh.url} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" onClick={copy} aria-label="Copy link">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </Button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button variant="secondary" aria-label="Share link" onClick={() => navigator.share({ title: `Join ${name}`, url: fresh.url }).catch(() => {})}>
                    <Share2 size={18} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={() => create.mutate({})} disabled={create.isPending}>
              Create invite link
            </Button>
          )}

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ email });
            }}
          >
            <Label htmlFor="inv-email">Or email it</Label>
            <div className="flex gap-2">
              <Input id="inv-email" type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" variant="secondary" disabled={create.isPending} aria-label="Send invite email">
                <Mail size={18} />
              </Button>
            </div>
          </form>

          {(data?.invites.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Active links</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data!.invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      Expires <RelativeTime iso={i.expiresAt} className="font-medium" /> · {i.uses} joined
                    </span>
                    <Button variant="ghost" size="sm" aria-label="Turn off this link" onClick={() => revoke.mutate(i.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
