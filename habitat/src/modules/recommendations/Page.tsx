'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { TimelineItem } from '@/components/TimelineItem';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import type { PageProps } from '../sdk/types';
import { useRecords } from '../sdk/hooks';
import { KINDS, RecCard } from './RecCard';
import { RecForm } from './RecForm';

export function Page(_: PageProps) {
  void _;
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState<'new' | 'loved'>('new');
  const q = useRecords({
    module: 'recommendations',
    collection: 'rec',
    where: kind === 'all' ? undefined : { kind: { eq: kind } },
    limit: 50,
  });
  const items = useMemo(
    () =>
      sort === 'loved'
        ? [...q.items].sort((a, b) => (b.reactionCounts['❤️'] ?? 0) - (a.reactionCounts['❤️'] ?? 0))
        : q.items,
    [q.items, sort],
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Recommendations</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> Recommend
        </Button>
      </div>
      <div className="flex gap-2">
        <Select
          aria-label="Filter by kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-auto"
        >
          <option value="all">Everything</option>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.emoji} {v.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'new' | 'loved')}
          className="w-auto"
        >
          <option value="new">Newest</option>
          <option value="loved">Most ❤️</option>
        </Select>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState emoji="💡" title="Nothing recommended yet">
          What’s the best thing you’ve watched, read or eaten lately?
        </EmptyState>
      ) : (
        items.map((r) => (
          <TimelineItem key={r.id} record={r}>
            <RecCard record={r} />
          </TimelineItem>
        ))
      )}
      {q.hasNextPage && (
        <Button variant="outline" onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
      {creating && <RecForm open onOpenChange={setCreating} />}
    </div>
  );
}
