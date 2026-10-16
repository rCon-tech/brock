'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { displayName } from '@/components/MemberAvatar';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';

export function Widget() {
  const { slug } = useHabitat();
  const q = useRecords({ module: 'chat', collection: 'message', limit: 3, pollMs: 15_000 });
  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Chat</h2>
      {q.items.length === 0 ? (
        <p className="text-sm text-ink-soft">No messages yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {[...q.items].reverse().map((m) => (
            <li key={m.id} className="truncate">
              <span className="font-semibold">{displayName(m.author).split(' ')[0]}:</span> {String(m.data.text || '📷')}
            </li>
          ))}
        </ul>
      )}
      <Link href={`/h/${slug}/m/chat`} className="inline-block text-sm font-semibold text-accent">
        Open chat →
      </Link>
    </Card>
  );
}
