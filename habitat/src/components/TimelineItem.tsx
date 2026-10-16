'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, MoreHorizontal, Pin } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CommentThread } from '@/components/CommentThread';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { ReactionBar } from '@/components/ReactionBar';
import { RelativeTime } from '@/components/RelativeTime';
import { ReportButton } from '@/components/ReportButton';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { getManifest } from '@/modules/registry';
import { isAdmin, useHabitat } from '@/modules/sdk/context';
import type { RecordDTO } from '@/modules/sdk/types';

/** Wraps any module's card with the parts every item shares: author, time, reactions, comments, menu. */
export function TimelineItem({ record, children, defaultOpen = false }: { record: RecordDTO; children: ReactNode; defaultOpen?: boolean }) {
  const { habitatId, me } = useHabitat();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(defaultOpen);
  const def = getManifest(record.module)?.collections[record.collection];
  const mine = record.author?.id === me.id;
  const canDelete = mine || isAdmin(me.role);
  const canPin = isAdmin(me.role) && def?.showInTimeline;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'timeline'] });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'records', record.module] });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'record'] });
  };
  const pin = useMutation({
    mutationFn: () => apiFetch(`/api/habitats/${habitatId}/records/${record.id}/pin`, { method: record.pinned ? 'DELETE' : 'PUT' }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/habitats/${habitatId}/records/${record.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Deleted');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card id={`record-${record.id}`} className="space-y-3">
      {record.pinned && (
        <p className="flex items-center gap-1 text-xs font-semibold text-accent">
          <Pin size={12} /> Pinned
        </p>
      )}
      <div className="flex items-center gap-3">
        <MemberAvatar member={record.author} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{displayName(record.author)}</div>
          <div className="text-xs text-ink-soft">
            <RelativeTime iso={record.createdAt} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="More actions" className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-2">
            <MoreHorizontal size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {canPin && <DropdownMenuItem onSelect={() => pin.mutate()}>{record.pinned ? 'Unpin' : 'Pin to top'}</DropdownMenuItem>}
            {!mine && <ReportButton targetType="record" targetId={record.id} asMenuItem />}
            {canDelete && (
              <DropdownMenuItem danger onSelect={() => confirm('Delete this?') && remove.mutate()}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {children}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReactionBar recordId={record.id} counts={record.reactionCounts} mine={record.myReactions} />
        <button type="button" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-ink-soft hover:bg-surface-2">
          <MessageCircle size={16} /> {record.commentCount > 0 ? record.commentCount : 'Comment'}
        </button>
      </div>
      {showComments && <CommentThread recordId={record.id} />}
    </Card>
  );
}
