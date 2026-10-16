'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useRealtime } from '@/components/RealtimeProvider';
import { useHabitat } from './context';
import type { RecordDTO } from './types';

export interface RecordsParams {
  module: string;
  collection: string;
  where?: Record<string, Partial<Record<'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in', string>>>;
  parentId?: string;
  authorId?: string;
  order?: string;
  limit?: number;
  enabled?: boolean;
  /** Poll interval when there is no live connection. */
  pollMs?: number;
}

function toQuery(p: RecordsParams, cursor?: string) {
  const q = new URLSearchParams({ module: p.module, collection: p.collection });
  if (p.parentId) q.set('parentId', p.parentId);
  if (p.authorId) q.set('authorId', p.authorId);
  if (p.order) q.set('order', p.order);
  if (p.limit) q.set('limit', String(p.limit));
  if (cursor) q.set('cursor', cursor);
  for (const [field, ops] of Object.entries(p.where ?? {})) {
    for (const [op, v] of Object.entries(ops)) if (v !== undefined) q.set(`where[${field}][${op}]`, v);
  }
  return q.toString();
}

const recordsKey = (habitatId: string, module: string, collection?: string) =>
  collection ? ['habitat', habitatId, 'records', module, collection] : ['habitat', habitatId, 'records', module];

/** Records of one collection, newest first by default, with "load more" paging. */
export function useRecords<T extends object = Record<string, unknown>>(p: RecordsParams) {
  const { habitatId } = useHabitat();
  const { live } = useRealtime();
  const query = useInfiniteQuery({
    queryKey: [...recordsKey(habitatId, p.module, p.collection), toQuery(p)],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<{ items: Array<RecordDTO & { data: T }>; nextCursor: string | null }>(
        `/api/habitats/${habitatId}/records?${toQuery(p, pageParam)}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: p.enabled ?? true,
    refetchInterval: p.pollMs && !live ? p.pollMs : false,
  });
  return { ...query, items: query.data?.pages.flatMap((pg) => pg.items) ?? [] };
}

export function useRecord<T extends object = Record<string, unknown>>(id: string | undefined) {
  const { habitatId } = useHabitat();
  return useQuery({
    queryKey: ['habitat', habitatId, 'record', id],
    queryFn: async () => (await apiFetch<{ record: RecordDTO & { data: T } }>(`/api/habitats/${habitatId}/records/${id}`)).record,
    enabled: !!id,
  });
}

function useInvalidate() {
  const { habitatId } = useHabitat();
  const qc = useQueryClient();
  return (module: string, collection?: string) => {
    qc.invalidateQueries({ queryKey: recordsKey(habitatId, module, collection) });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'record'] });
  };
}

export function useCreateRecord(module: string, collection: string) {
  const { habitatId } = useHabitat();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { data: Record<string, unknown>; parentId?: string }) =>
      (await apiFetch<{ record: RecordDTO }>(`/api/habitats/${habitatId}/records`, {
        method: 'POST',
        body: { module, collection, parentId: v.parentId, data: v.data },
      })).record,
    onSuccess: () => invalidate(module),
  });
}

export function useUpdateRecord(module: string) {
  const { habitatId } = useHabitat();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; data: Record<string, unknown> }) =>
      (await apiFetch<{ record: RecordDTO }>(`/api/habitats/${habitatId}/records/${v.id}`, {
        method: 'PATCH',
        body: { data: v.data },
      })).record,
    onSuccess: () => invalidate(module),
  });
}

export function useDeleteRecord(module: string) {
  const { habitatId } = useHabitat();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/habitats/${habitatId}/records/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(module),
  });
}
