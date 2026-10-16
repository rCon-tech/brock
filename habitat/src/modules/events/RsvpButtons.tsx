'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-client';
import { useHabitat } from '../sdk/context';
import { useCreateRecord, useRecords } from '../sdk/hooks';

export const STATUSES = [
  { value: 'going', label: 'Going', emoji: '✅' },
  { value: 'maybe', label: 'Maybe', emoji: '🤔' },
  { value: 'no', label: 'Can’t make it', emoji: '❌' },
] as const;

export function useRsvps(eventId: string) {
  const { me } = useHabitat();
  const q = useRecords<{ status: 'going' | 'maybe' | 'no' }>({ module: 'events', collection: 'rsvp', parentId: eventId, limit: 100, pollMs: 30_000 });
  const mine = q.items.find((r) => r.author?.id === me.id);
  return { ...q, mine: mine?.data.status ?? null };
}

export function RsvpButtons({ eventId, size = 'md' }: { eventId: string; size?: 'sm' | 'md' }) {
  const { mine } = useRsvps(eventId);
  const create = useCreateRecord('events', 'rsvp');
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Your answer">
      {STATUSES.map((s) => (
        <Button
          key={s.value}
          size={size}
          variant={mine === s.value ? 'primary' : 'outline'}
          aria-pressed={mine === s.value}
          disabled={create.isPending}
          onClick={() => create.mutate({ parentId: eventId, data: { status: s.value } }, { onError: (e) => toast.error(errorMessage(e)) })}
        >
          <span aria-hidden>{s.emoji}</span> {s.label}
        </Button>
      ))}
    </div>
  );
}
