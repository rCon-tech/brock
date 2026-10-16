'use client';

import { format, isSameDay } from 'date-fns';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MediaGrid } from '../feed/FeedCard';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { RichText } from '@/components/RichText';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useHabitat } from '../sdk/context';
import type { RecordDTO } from '../sdk/types';

export function MessageList({
  items,
  loading,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: {
  items: RecordDTO[];
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const { me, members } = useHabitat();
  const names = members.flatMap((m) => [m.name, m.nickname ?? '']).filter(Boolean);
  const ordered = useMemo(() => [...items].reverse(), [items]);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevHeight = useRef(0);
  const lastId = ordered[ordered.length - 1]?.id;

  // Stay pinned to the bottom for new messages, unless the reader has scrolled up.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
    else if (prevHeight.current) el.scrollTop += el.scrollHeight - prevHeight.current; // older messages loaded above
    prevHeight.current = el.scrollHeight;
  }, [lastId, ordered.length]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      prevHeight.current = el.scrollHeight;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={box} className="flex-1 space-y-1 overflow-y-auto px-1 py-2" role="log" aria-live="polite" aria-label="Chat messages">
      {hasOlder && (
        <div className="flex justify-center py-2">
          <Button variant="ghost" size="sm" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder ? 'Loading…' : 'Earlier messages'}
          </Button>
        </div>
      )}
      {loading && <Skeleton className="h-16" />}
      {!loading && ordered.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">No messages yet. Say hi 👋</p>}
      {ordered.map((m, i) => {
        const prev = ordered[i - 1];
        const mine = m.author?.id === me.id;
        const newDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
        const grouped = !newDay && prev?.author?.id === m.author?.id && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
        const text = typeof m.data.text === 'string' ? m.data.text : '';
        const ids = (m.data.mediaIds as string[] | undefined) ?? [];
        return (
          <div key={m.id}>
            {newDay && <div className="py-2 text-center text-xs font-semibold text-ink-soft">{format(new Date(m.createdAt), 'EEEE d MMMM')}</div>}
            <div className={cn('flex gap-2', mine && 'flex-row-reverse', grouped ? 'mt-0.5' : 'mt-2')}>
              <div className="w-8 shrink-0">{!grouped && !mine && <MemberAvatar member={m.author} size="sm" />}</div>
              <div className={cn('max-w-[80%]', mine && 'items-end')}>
                {!grouped && !mine && <div className="mb-0.5 px-1 text-xs font-semibold text-ink-soft">{displayName(m.author)}</div>}
                <div className={cn('rounded-2xl px-3 py-2', mine ? 'bg-accent text-accent-ink' : 'bg-surface-2')} title={format(new Date(m.createdAt), 'HH:mm')}>
                  {text && <RichText text={text} names={names} className="text-[15px]" />}
                  {ids.length > 0 && <div className="mt-1"><MediaGrid ids={ids} alt={`Photo from ${displayName(m.author)}`} /></div>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
