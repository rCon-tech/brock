'use client';

import { Card } from '@/components/ui/card';
import { useRecords } from '../../sdk/hooks';
import type { Filter } from '../mdl-schema';
import { asWhere } from './ListBlock';

/** "3 of 12 ticked off": a count of records that match the filter, out of all of them. */
export function CounterBlock({
  moduleId,
  collection,
  filter,
  label,
}: {
  moduleId: string;
  collection: string;
  filter?: Filter;
  label: string;
}) {
  const all = useRecords({ module: moduleId, collection, limit: 100, pollMs: 30_000 });
  const some = useRecords({
    module: moduleId,
    collection,
    where: asWhere(filter),
    limit: 100,
    pollMs: 30_000,
  });
  const total = all.items.length;
  const n = some.items.length;
  const capped = !!all.hasNextPage;
  return (
    <Card className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-2xl font-extrabold">
        {n}
        <span className="text-base font-medium text-ink-soft">
          {' '}
          of {total}
          {capped ? '+' : ''}
        </span>
      </span>
    </Card>
  );
}
