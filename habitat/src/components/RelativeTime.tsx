'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { useNow } from '@/lib/use-now';

/** "3h ago", refreshed every minute, with the exact date on hover. Shows the plain date until hydrated. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useNow(60_000);
  const d = new Date(iso);
  const known = now > 0;
  // `now` is rounded down to the minute, so anything within a minute of it counts as just now.
  const text = !known
    ? d.toISOString().slice(0, 10)
    : Math.abs(now - d.getTime()) < 60_000
      ? 'just now'
      : `${formatDistanceToNowStrict(d)} ${d.getTime() > now ? 'from now' : 'ago'}`;
  return (
    <time dateTime={iso} title={known ? d.toLocaleString() : undefined} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
