'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { displayName } from '@/components/MemberAvatar';
import { useHabitat, useMemberLookup } from '../sdk/context';
import { formatMoney } from './settle';
import { useCosts } from './useCosts';

export function Widget() {
  const { me, slug } = useHabitat();
  const who = useMemberLookup();
  const costs = useCosts();
  const mine = Object.entries(costs.transfers).flatMap(([cur, ts]) =>
    ts.filter((t) => t.from === me.id || t.to === me.id).map((t) => ({ ...t, cur })),
  );
  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Split costs</h2>
      {mine.length === 0 ? (
        <p className="text-sm text-ink-soft">You’re all square.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {mine.map((t) => (
            <li key={`${t.cur}${t.from}${t.to}`}>
              {t.from === me.id ? (
                <>
                  You owe <strong>{displayName(who(t.to))}</strong>{' '}
                  {formatMoney(t.amountMinor, t.cur)}
                </>
              ) : (
                <>
                  <strong>{displayName(who(t.from))}</strong> owes you{' '}
                  {formatMoney(t.amountMinor, t.cur)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/h/${slug}/m/split-costs`}
        className="inline-block text-sm font-semibold text-accent"
      >
        Open →
      </Link>
    </Card>
  );
}
