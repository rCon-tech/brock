'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { displayName } from '@/components/MemberAvatar';
import { useHabitat, useMemberLookup } from '../sdk/context';
import { inDaysLabel, useBirthdays } from './Page';
import { upcoming } from './upcoming';

export function Widget() {
  const { slug } = useHabitat();
  const who = useMemberLookup();
  const { entries } = useBirthdays();
  const next = useMemo(() => upcoming(entries, new Date(), 3), [entries]);
  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Birthdays</h2>
      {next.length === 0 ? (
        <p className="text-sm text-ink-soft">None added yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {next.map((b) => (
            <li key={b.userId} className="flex justify-between gap-2">
              <span className="truncate font-semibold">{displayName(who(b.userId))}</span>
              <span className="shrink-0 text-ink-soft">{inDaysLabel(b.inDays)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/h/${slug}/m/birthdays`}
        className="inline-block text-sm font-semibold text-accent"
      >
        See all →
      </Link>
    </Card>
  );
}
