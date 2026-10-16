'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { NotificationDTO } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RelativeTime } from '@/components/RelativeTime';

export function notificationHref(n: Pick<NotificationDTO, 'type' | 'habitat' | 'recordId' | 'payload'>) {
  const base = `/h/${n.habitat.slug}`;
  if (n.type.startsWith('proposal.')) return `${base}/proposals`;
  const moduleId = typeof n.payload.moduleId === 'string' ? n.payload.moduleId : null;
  if (moduleId && n.recordId) return `${base}/m/${moduleId}/${n.recordId}`;
  if (moduleId) return `${base}/m/${moduleId}`;
  return base;
}

function describe(n: NotificationDTO) {
  if (typeof n.payload.text === 'string') return n.payload.text;
  if (n.type === 'proposal.opened') return `${n.actor?.name ?? 'Someone'} started a vote`;
  if (n.type === 'proposal.decided') return `A vote has ${n.payload.status === 'passed' ? 'passed' : 'ended'}`;
  return 'Something happened';
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<{ items: NotificationDTO[]; unread: number }>('/api/notifications?limit=20'),
    refetchInterval: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => apiFetch('/api/notifications/read', { method: 'POST', body: { ids: 'all' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative">
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between px-2 py-1">
          <h2 className="text-sm font-bold">Notifications</h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(data?.items ?? []).length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-soft">Nothing yet.</li>}
          {data?.items.map((n) => (
            <li key={n.id}>
              <Link
                href={notificationHref(n)}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-2 hover:bg-surface-2 ${n.read ? 'opacity-70' : ''}`}
              >
                <p className="text-sm">{describe(n)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {n.habitat.emoji} {n.habitat.name} · <RelativeTime iso={n.createdAt} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
