'use client';

import { Gift, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { RichText } from '@/components/RichText';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-client';
import { useHabitat } from '../sdk/context';
import { useCreateRecord, useDeleteRecord } from '../sdk/hooks';
import type { RecordDTO } from '../sdk/types';

export function WishCard({ wish, claim }: { wish: RecordDTO; claim?: RecordDTO }) {
  const { me } = useHabitat();
  const d = wish.data as { title: string; link?: string; price?: string; note?: string };
  const mine = wish.author?.id === me.id;
  const claimIt = useCreateRecord('wishlist', 'claim');
  const unclaim = useDeleteRecord('wishlist');
  const del = useDeleteRecord('wishlist');

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent">
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {d.link ? (
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-accent underline underline-offset-2"
              >
                {d.title}
              </a>
            ) : (
              d.title
            )}
            {d.price && <span className="ml-2 text-sm font-normal text-ink-soft">{d.price}</span>}
          </div>
          {d.note && <RichText text={d.note} className="text-sm text-ink-soft" />}
        </div>
        {mine && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${d.title}`}
            onClick={() => confirm('Remove this wish?') && del.mutate(wish.id)}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
      {!mine && (
        <div className="flex items-center gap-2">
          {claim ? (
            <>
              <Badge tone="ok" className="gap-1">
                <MemberAvatar member={claim.author} size="xs" /> Claimed by{' '}
                {claim.author?.id === me.id ? 'you' : displayName(claim.author)}
              </Badge>
              {claim.author?.id === me.id && (
                <Button variant="ghost" size="sm" onClick={() => unclaim.mutate(claim.id)}>
                  Unclaim
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={claimIt.isPending}
              onClick={() =>
                claimIt.mutate(
                  { parentId: wish.id, data: {} },
                  { onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              I’ll get this
            </Button>
          )}
        </div>
      )}
      {mine && (
        <p className="text-xs text-ink-soft">Friends can claim this. You won’t see who. 🤫</p>
      )}
    </Card>
  );
}
