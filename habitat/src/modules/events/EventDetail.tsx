'use client';

import { format } from 'date-fns';
import { ArrowLeft, CalendarPlus, MapPin, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CommentThread } from '@/components/CommentThread';
import { EmptyState } from '@/components/EmptyState';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { RichText } from '@/components/RichText';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { isAdmin, useHabitat } from '../sdk/context';
import { useRecord } from '../sdk/hooks';
import { EventForm, type EventData } from './EventForm';
import { STATUSES, RsvpButtons, useRsvps } from './RsvpButtons';
import { toIcs } from './ics';

export const formatWhen = (iso: string, endIso?: string) => {
  const s = new Date(iso);
  let out = format(s, "EEE d MMM yyyy 'at' HH:mm");
  if (endIso) {
    const e = new Date(endIso);
    out += s.toDateString() === e.toDateString() ? ` – ${format(e, 'HH:mm')}` : ` → ${format(e, "EEE d MMM 'at' HH:mm")}`;
  }
  return out;
};

export function EventDetail({ eventId }: { eventId: string }) {
  const { slug, name, me } = useHabitat();
  const event = useRecord<EventData>(eventId);
  const rsvps = useRsvps(eventId);
  const [editing, setEditing] = useState(false);

  if (event.isLoading) return <Skeleton className="h-48" />;
  if (event.isError || !event.data) return <EmptyState emoji="🌫️" title="That event isn’t here anymore" />;
  const e = event.data;
  const canEdit = e.author?.id === me.id || isAdmin(me.role);
  const { title, startsAt, endsAt, location, details } = e.data;

  function download() {
    const blob = new Blob([toIcs({ id: e.id, title, startsAt, endsAt, location, details }, name)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, '-').toLowerCase() || 'event'}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Link href={`/h/${slug}/m/events`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={14} /> Events
      </Link>
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{title}</h1>
            <p className="font-medium text-accent">{formatWhen(startsAt, endsAt)}</p>
            {location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                <MapPin size={14} /> {location}
              </p>
            )}
          </div>
          {canEdit && (
            <Button variant="ghost" size="icon" aria-label="Edit event" onClick={() => setEditing(true)}>
              <Pencil size={18} />
            </Button>
          )}
        </div>
        {details && <RichText text={details} />}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <RsvpButtons eventId={eventId} />
          <Button variant="ghost" onClick={download}>
            <CalendarPlus size={16} /> Add to calendar
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Who’s coming</h2>
        {rsvps.items.length === 0 ? (
          <p className="text-sm text-ink-soft">Nobody has answered yet.</p>
        ) : (
          STATUSES.map((s) => {
            const who = rsvps.items.filter((r) => r.data.status === s.value);
            if (!who.length) return null;
            return (
              <div key={s.value}>
                <h3 className="mb-1 text-sm font-semibold text-ink-soft">
                  {s.emoji} {s.label} ({who.length})
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {who.map((r) => (
                    <li key={r.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm">
                      <MemberAvatar member={r.author} size="xs" /> {displayName(r.author)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Discussion</h2>
        <CommentThread recordId={eventId} />
      </Card>

      {editing && <EventForm open onOpenChange={setEditing} existing={{ id: e.id, data: e.data }} />}
    </div>
  );
}
