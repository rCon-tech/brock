'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { TimelineItem } from '@/components/TimelineItem';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { useHabitat } from '../sdk/context';
import { useRecord, useRecords } from '../sdk/hooks';
import type { PageProps } from '../sdk/types';
import { PollForm } from './PollForm';
import { PollView, type PollData } from './PollView';

export function Page({ path }: PageProps) {
  if (path[0]) return <OnePoll id={path[0]} />;
  return <PollList />;
}

function PollList() {
  const [creating, setCreating] = useState(false);
  const q = useRecords<PollData>({ module: 'polls', collection: 'poll', limit: 20 });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Polls</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> New poll
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : q.items.length === 0 ? (
        <EmptyState emoji="🗳️" title="No polls yet">Ask the group something.</EmptyState>
      ) : (
        q.items.map((p) => (
          <TimelineItem key={p.id} record={p}>
            <PollView poll={p} />
          </TimelineItem>
        ))
      )}
      {q.hasNextPage && (
        <Button variant="outline" onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
      {creating && <PollForm open onOpenChange={setCreating} />}
    </div>
  );
}

function OnePoll({ id }: { id: string }) {
  const { slug } = useHabitat();
  const q = useRecord<PollData>(id);
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!q.data) return <EmptyState emoji="🌫️" title="That poll isn’t here anymore" />;
  return (
    <div className="space-y-3">
      <Link href={`/h/${slug}/m/polls`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft size={14} /> Polls
      </Link>
      <TimelineItem record={q.data} defaultOpen>
        <PollView poll={q.data} />
      </TimelineItem>
    </div>
  );
}
