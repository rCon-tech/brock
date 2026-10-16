'use client';

import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useHabitat, useMemberLookup } from '../sdk/context';
import { useCreateRecord, useDeleteRecord, useRecords } from '../sdk/hooks';
import { upcoming, validMonthDay, type BirthdayEntry } from './upcoming';

const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), 'MMMM'));

export function useBirthdays() {
  const q = useRecords<{ month: number; day: number; year?: number }>({
    module: 'birthdays',
    collection: 'birthday',
    limit: 100,
  });
  const entries: Array<BirthdayEntry & { recordId: string }> = q.items
    .filter((r) => r.author)
    .map((r) => ({
      recordId: r.id,
      userId: r.author!.id,
      month: r.data.month,
      day: r.data.day,
      year: r.data.year,
    }));
  return { ...q, entries };
}

export function inDaysLabel(n: number) {
  return n === 0 ? 'Today! 🎂' : n === 1 ? 'Tomorrow' : `in ${n} days`;
}

export function Page() {
  const { me } = useHabitat();
  const who = useMemberLookup();
  const { entries, isLoading } = useBirthdays();
  const create = useCreateRecord('birthdays', 'birthday');
  const remove = useDeleteRecord('birthdays');
  const mine = entries.find((e) => e.userId === me.id);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState('');
  const list = useMemo(() => upcoming(entries, new Date(), 200), [entries]);

  function save() {
    create.mutate(
      { data: { month, day, year: year ? Number(year) : undefined } },
      { onSuccess: () => toast.success('Saved'), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold">Birthdays</h1>
      <Card className="space-y-3">
        <h2 className="font-bold">{mine ? 'Your birthday' : 'Add yours'}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="bm">Month</Label>
            <Select id="bm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-24">
            <Label htmlFor="bd">Day</Label>
            <Input
              id="bd"
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="by">Year (optional)</Label>
            <Input
              id="by"
              type="number"
              min={1900}
              max={2100}
              placeholder="1990"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <Button onClick={save} disabled={create.isPending || !validMonthDay(month, day)}>
            {mine ? 'Update' : 'Save'}
          </Button>
          {mine && (
            <Button variant="ghost" onClick={() => remove.mutate(mine.recordId)}>
              Remove
            </Button>
          )}
        </div>
        {!validMonthDay(month, day) && (
          <p className="text-sm text-danger">That date doesn’t exist.</p>
        )}
        <p className="text-xs text-ink-soft">
          Only this Habitat’s members can see it. Leave the year blank to keep your age private.
        </p>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : list.length === 0 ? (
        <EmptyState emoji="🎂" title="No birthdays yet">
          Add yours so nobody forgets.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((b) => {
            const m = who(b.userId);
            return (
              <li key={b.userId} className="flex items-center gap-3 px-4 py-3">
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{displayName(m)}</div>
                  <div className="text-sm text-ink-soft">
                    {format(new Date(`${b.date}T00:00:00`), 'd MMMM')}
                    {b.turning ? ` · turning ${b.turning}` : ''}
                  </div>
                </div>
                <div className={b.inDays === 0 ? 'font-bold text-accent' : 'text-sm text-ink-soft'}>
                  {inDaysLabel(b.inDays)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
