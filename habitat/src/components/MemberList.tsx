'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Shield, Crown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { ReportButton } from '@/components/ReportButton';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { canRemoveMember } from '@/lib/permissions';
import { useHabitat } from '@/modules/sdk/context';

export function MemberList() {
  const { habitatId, slug, me, members } = useHabitat();
  const router = useRouter();
  const qc = useQueryClient();

  const act = useMutation({
    mutationFn: (v: {
      userId: string;
      method: 'PATCH' | 'DELETE' | 'POST';
      body?: unknown;
      url?: string;
    }) =>
      apiFetch(v.url ?? `/api/habitats/${habitatId}/members/${v.userId}`, {
        method: v.method,
        body: v.body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habitat', habitatId] });
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {members.map((m) => {
        const isMe = m.id === me.id;
        const canRemove = !isMe && canRemoveMember(me.role, me.id, m.role, m.id);
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Link
              href={`/h/${slug}/members/${m.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <MemberAvatar member={m} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {displayName(m)}{' '}
                  {isMe && <span className="font-normal text-ink-soft">(you)</span>}
                </span>
                {m.nickname && (
                  <span className="block truncate text-xs text-ink-soft">{m.name}</span>
                )}
              </span>
            </Link>
            {m.role === 'owner' && (
              <Badge tone="accent">
                <Crown size={12} className="mr-1" /> Owner
              </Badge>
            )}
            {m.role === 'admin' && (
              <Badge tone="accent">
                <Shield size={12} className="mr-1" /> Admin
              </Badge>
            )}
            {(!isMe || me.role !== 'owner') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${displayName(m)}`}>
                    <MoreHorizontal size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {me.role === 'owner' && !isMe && m.role === 'member' && (
                    <DropdownMenuItem
                      onSelect={() =>
                        act.mutate({ userId: m.id, method: 'PATCH', body: { role: 'admin' } })
                      }
                    >
                      Make admin
                    </DropdownMenuItem>
                  )}
                  {me.role === 'owner' && !isMe && m.role === 'admin' && (
                    <DropdownMenuItem
                      onSelect={() =>
                        act.mutate({ userId: m.id, method: 'PATCH', body: { role: 'member' } })
                      }
                    >
                      Remove admin
                    </DropdownMenuItem>
                  )}
                  {me.role === 'owner' && !isMe && (
                    <DropdownMenuItem
                      onSelect={() => {
                        if (
                          confirm(
                            `Hand ${displayName(m)} ownership of this Habitat? You’ll become an admin.`,
                          )
                        ) {
                          act.mutate({
                            userId: m.id,
                            method: 'POST',
                            body: { userId: m.id },
                            url: `/api/habitats/${habitatId}`,
                          });
                        }
                      }}
                    >
                      Make owner
                    </DropdownMenuItem>
                  )}
                  {!isMe && <ReportButton targetType="member" targetId={m.id} asMenuItem />}
                  {canRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        danger
                        onSelect={() => {
                          if (confirm(`Remove ${displayName(m)} from this Habitat?`))
                            act.mutate({ userId: m.id, method: 'DELETE' });
                        }}
                      >
                        Remove from Habitat
                      </DropdownMenuItem>
                    </>
                  )}
                  {isMe && me.role !== 'owner' && (
                    <DropdownMenuItem
                      danger
                      onSelect={async () => {
                        if (
                          !confirm(
                            'Leave this Habitat? Your posts will stay, shown as from a former member.',
                          )
                        )
                          return;
                        try {
                          await apiFetch(`/api/habitats/${habitatId}/members/${me.id}`, {
                            method: 'DELETE',
                          });
                          router.push('/');
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      Leave Habitat
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
    </ul>
  );
}
