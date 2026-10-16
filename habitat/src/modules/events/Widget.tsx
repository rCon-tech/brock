'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useNow } from '@/lib/use-now';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';
import type { EventData } from './EventForm';

export function Widget() {
  const { slug } = useHabitat();
  const nowMs = useNow(60_000);
  const now = new Date(nowMs).toISOString();
  const q = useRecords<EventData>({ module: 'events', collection: 'event', where: { startsAt: { gte: now } }, order: 'startsAt:asc', limit: 3, enabled: nowMs > 0 });
  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Coming up</h2>
      {q.items.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing planned yet.</p>
      ) : (
        <ul className="space-y-2">
          {q.items.map((e) => (
            <li key={e.id}>
              <Link href={`/h/${slug}/m/events/${e.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-surface-2">
                <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-accent/15 py-1 text-center leading-tight">
                  <span className="text-[10px] font-bold uppercase text-accent">{format(new Date(e.data.startsAt), 'MMM')}</span>
                  <span className="text-lg font-extrabold">{format(new Date(e.data.startsAt), 'd')}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{e.data.title}</span>
                  <span className="block text-xs text-ink-soft">{format(new Date(e.data.startsAt), 'EEE HH:mm')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
