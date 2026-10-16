'use client';

import { CalendarDays, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useHabitat } from '../sdk/context';
import type { FeedCardProps } from '../sdk/types';
import { formatWhen } from './EventDetail';
import { RsvpButtons } from './RsvpButtons';

export function FeedCard({ record }: FeedCardProps) {
  const { slug } = useHabitat();
  const d = record.data as { title: string; startsAt: string; endsAt?: string; location?: string };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">planned an event</p>
      <Link href={`/h/${slug}/m/events/${record.id}`} className="block rounded-xl bg-surface-2 p-3">
        <div className="flex items-center gap-2 font-bold">
          <CalendarDays size={18} className="text-accent" /> {d.title}
        </div>
        <div className="mt-1 text-sm text-accent">{formatWhen(d.startsAt, d.endsAt)}</div>
        {d.location && (
          <div className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
            <MapPin size={13} /> {d.location}
          </div>
        )}
      </Link>
      <RsvpButtons eventId={record.id} size="sm" />
    </div>
  );
}
