'use client';

import { useRealtime } from '@/components/RealtimeProvider';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

export function Page() {
  const { members, me } = useHabitat();
  const { typing, live } = useRealtime();
  // Polls every few seconds only when there is no live connection.
  const q = useRecords({ module: 'chat', collection: 'message', limit: 40, pollMs: 4000 });
  const who = typing
    .map((id) => members.find((m) => m.id === id))
    .filter((m) => m && m.id !== me.id)
    .map((m) => m!.nickname || m!.name.split(' ')[0]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] max-w-2xl flex-col md:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Chat</h1>
      <MessageList
        items={q.items}
        loading={q.isLoading}
        hasOlder={!!q.hasNextPage}
        loadingOlder={q.isFetchingNextPage}
        onLoadOlder={() => q.fetchNextPage()}
      />
      <div className="h-5 px-2 text-xs text-ink-soft" aria-live="polite">
        {who.length > 0 && `${who.join(', ')} ${who.length > 1 ? 'are' : 'is'} typing…`}
        {!live && who.length === 0 && ''}
      </div>
      <MessageInput />
    </div>
  );
}
