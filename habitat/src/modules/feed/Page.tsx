'use client';

import { EmptyState } from '@/components/EmptyState';
import { TimelineItem } from '@/components/TimelineItem';
import { Skeleton } from '@/components/ui/card';
import { useRecord } from '../sdk/hooks';
import type { PageProps } from '../sdk/types';
import { Composer } from './Composer';
import { FeedCard } from './FeedCard';

/** `/m/feed` writes a post; `/m/feed/<id>` shows one post with its comments (notifications link here). */
export function Page({ path }: PageProps) {
  if (path[0]) return <SinglePost id={path[0]} />;
  return <Composer />;
}

function SinglePost({ id }: { id: string }) {
  const { data, isLoading, isError } = useRecord(id);
  if (isLoading) return <Skeleton className="h-40" />;
  if (isError || !data) return <EmptyState emoji="🌫️" title="That post isn’t here anymore" />;
  return (
    <TimelineItem record={data} defaultOpen>
      <FeedCard record={data} />
    </TimelineItem>
  );
}
