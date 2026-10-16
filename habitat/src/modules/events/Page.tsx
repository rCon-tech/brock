'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNow } from '@/lib/use-now';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';
import type { PageProps, RecordDTO } from '../sdk/types';
import { EventDetail, formatWhen } from './EventDetail';
import { EventForm, type EventData } from './EventForm';
import { RsvpButtons } from './RsvpButtons';

export function Page({ path }: PageProps) {
  if (path[0]) return <EventDetail eventId={path[0]} />;
  return <EventList />;
}

function EventList() {
  const [creating, setCreating] = useState(false);
  const nowMs = useNow(60_000);
  const now = new Date(nowMs).toISOString();
  const upcoming = useRecords<EventData>({ module: 'events', collection: 'event', where: { startsAt: { gte: now } }, order: 'startsAt:asc', limit: 30, enabled: nowMs > 0 });
  const past = useRecords<EventData>({ module: 'events', collection: 'event', where: { startsAt: { lt: now } }, order: 'startsAt:desc', limit: 30, enabled: nowMs > 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Events</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> New event
        </Button>
      </div>
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <List q={upcoming} empty={<EmptyState emoji="📅" title="Nothing planned">Be the one to suggest something.</EmptyState>} showRsvp />
        </TabsContent>
        <TabsContent value="past">
          <List q={past} empty={<EmptyState emoji="🕰️" title="No past events yet" />} />
        </TabsContent>
      </Tabs>
      {creating && <EventForm open onOpenChange={setCreating} />}
    </div>
  );
}

function List({ q, empty, showRsvp }: { q: ReturnType<typeof useRecords<EventData>>; empty: React.ReactNode; showRsvp?: boolean }) {
  const { slug } = useHabitat();
  if (q.isLoading) return <Skeleton className="h-28" />;
  if (!q.items.length) return <>{empty}</>;
  return (
    <ul className="space-y-3">
      {q.items.map((e: RecordDTO & { data: EventData }) => (
        <li key={e.id}>
          <Card className="space-y-3">
            <Link href={`/h/${slug}/m/events/${e.id}`} className="block">
              <div className="font-bold">{e.data.title}</div>
              <div className="text-sm text-accent">{formatWhen(e.data.startsAt, e.data.endsAt)}</div>
              {e.data.location && <div className="text-sm text-ink-soft">{e.data.location}</div>}
            </Link>
            {showRsvp && <RsvpButtons eventId={e.id} size="sm" />}
          </Card>
        </li>
      ))}
      {q.hasNextPage && (
        <Button variant="outline" onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
    </ul>
  );
}
