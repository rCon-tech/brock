'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useHabitat } from '../sdk/context';
import { useRecords } from '../sdk/hooks';
import { WishCard } from './WishCard';
import { WishForm } from './WishForm';

export function Page() {
  const { me, members } = useHabitat();
  const [who, setWho] = useState(me.id);
  const [creating, setCreating] = useState(false);
  const wishes = useRecords({ module: 'wishlist', collection: 'wish', authorId: who, limit: 100, order: 'createdAt:asc' });
  // Claims come back already filtered: the server never returns claims on the viewer's own wishes.
  const claims = useRecords({ module: 'wishlist', collection: 'claim', limit: 100, pollMs: 30_000 });
  const claimFor = (wishId: string) => claims.items.find((c) => c.parentId === wishId);
  const person = members.find((m) => m.id === who);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Wishlist</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> Add a wish
        </Button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Whose wishlist">
        {[...members].sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id)).map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={who === m.id}
            onClick={() => setWho(m.id)}
            className={cn('flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold', who === m.id ? 'border-accent bg-accent/15' : 'border-line')}
          >
            <MemberAvatar member={m} size="xs" /> {m.id === me.id ? 'You' : displayName(m).split(' ')[0]}
          </button>
        ))}
      </div>
      {wishes.isLoading ? (
        <Skeleton className="h-28" />
      ) : wishes.items.length === 0 ? (
        <EmptyState emoji="🎁" title={who === me.id ? 'Your wishlist is empty' : `${displayName(person)} hasn’t added anything`} />
      ) : (
        wishes.items.map((w) => <WishCard key={w.id} wish={w} claim={claimFor(w.id)} />)
      )}
      {creating && <WishForm open onOpenChange={setCreating} />}
    </div>
  );
}
