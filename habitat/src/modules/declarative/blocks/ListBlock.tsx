'use client';

import { EmptyState } from '@/components/EmptyState';
import { TimelineItem } from '@/components/TimelineItem';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { useRecords } from '../../sdk/hooks';
import type { Cell, Filter } from '../mdl-schema';
import { FieldText } from './FieldText';
import { ToggleBlock } from './ToggleBlock';

export const asWhere = (f?: Filter) => (f ? { [f.field]: { [f.op]: String(f.value) } } : undefined);

/** A list of records. Each one is wrapped in the standard item, so comments and reactions come for free. */
export function ListBlock({
  moduleId,
  collection,
  filter,
  order,
  empty,
  cells,
}: {
  moduleId: string;
  collection: string;
  filter?: Filter;
  order?: string;
  empty?: string;
  cells: Cell[];
}) {
  const q = useRecords({
    module: moduleId,
    collection,
    where: asWhere(filter),
    order,
    limit: 50,
    pollMs: 30_000,
  });
  if (q.isLoading) return <Skeleton className="h-24" />;
  if (!q.items.length) return <EmptyState emoji="🌱" title={empty ?? 'Nothing here yet'} />;
  return (
    <div className="space-y-3">
      {q.items.map((r) => (
        <TimelineItem key={r.id} record={r}>
          <div className="flex items-start gap-3">
            {cells
              .filter((c) => c.as === 'toggle')
              .map((c) => (
                <ToggleBlock
                  key={c.field}
                  moduleId={moduleId}
                  recordId={r.id}
                  field={c.field}
                  value={!!r.data[c.field]}
                  label={`Mark done: ${String(r.data.title ?? '')}`}
                />
              ))}
            <div className="min-w-0 flex-1 space-y-1">
              {cells
                .filter((c) => c.as !== 'toggle')
                .map((c) => (
                  <FieldText key={c.field} cell={c} value={r.data[c.field]} />
                ))}
            </div>
          </div>
        </TimelineItem>
      ))}
      {q.hasNextPage && (
        <Button variant="outline" onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
    </div>
  );
}
