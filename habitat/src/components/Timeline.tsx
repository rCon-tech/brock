'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { CardFor } from '@/components/CardFor';
import { EmptyState } from '@/components/EmptyState';
import { TimelineItem } from '@/components/TimelineItem';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { useHabitat } from '@/modules/sdk/context';
import type { RecordDTO } from '@/modules/sdk/types';

type TimelinePage = { pinned: RecordDTO[]; items: RecordDTO[]; nextCursor: string | null };

/** The home timeline: every installed module's timeline items, newest first, pinned on top (H10). */
export function Timeline() {
  const { habitatId } = useHabitat();
  const q = useInfiniteQuery({
    queryKey: ['habitat', habitatId, 'timeline'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<TimelinePage>(
        `/api/habitats/${habitatId}/timeline${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
    refetchInterval: 45_000,
  });
  const pinned = q.data?.pages[0]?.pinned ?? [];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-3">
      {pinned.length > 0 && (
        <section aria-label="Pinned" className="space-y-3">
          {pinned.map((r) => (
            <TimelineItem key={r.id} record={r}>
              <CardFor record={r} />
            </TimelineItem>
          ))}
        </section>
      )}
      {q.isLoading && (
        <>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </>
      )}
      {!q.isLoading && !pinned.length && !items.length && (
        <EmptyState emoji="👋" title="It’s quiet in here">
          Say hello! Your first post will show up for everyone in the Habitat.
        </EmptyState>
      )}
      {items.map((r) => (
        <TimelineItem key={r.id} record={r}>
          <CardFor record={r} />
        </TimelineItem>
      ))}
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
