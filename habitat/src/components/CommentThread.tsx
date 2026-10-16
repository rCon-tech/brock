'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { MentionInput } from '@/components/MentionInput';
import { RelativeTime } from '@/components/RelativeTime';
import { ReportButton } from '@/components/ReportButton';
import { RichText } from '@/components/RichText';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { CommentDTO } from '@/lib/interactions';
import { isAdmin, useHabitat } from '@/modules/sdk/context';

export function CommentThread({ recordId }: { recordId: string }) {
  const { habitatId } = useHabitat();
  const qc = useQueryClient();
  const key = ['habitat', habitatId, 'comments', recordId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<{ comments: CommentDTO[] }>(
        `/api/habitats/${habitatId}/records/${recordId}/comments`,
      ),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'records'] });
    qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'timeline'] });
  };

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-ink-soft">Loading…</p>}
      <ul className="space-y-3">
        {data?.comments.map((c) => (
          <li key={c.id}>
            <CommentItem c={c} onChange={refresh} recordId={recordId} />
            {c.replies.length > 0 && (
              <ul className="ml-10 mt-2 space-y-3 border-l border-line pl-3">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} onChange={refresh} recordId={recordId} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <CommentForm recordId={recordId} onDone={refresh} placeholder="Write a comment…" />
    </div>
  );
}

function CommentForm({
  recordId,
  parentCommentId,
  onDone,
  placeholder,
  autoFocus,
}: {
  recordId: string;
  parentCommentId?: string;
  onDone: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const { habitatId } = useHabitat();
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () =>
      apiFetch(`/api/habitats/${habitatId}/records/${recordId}/comments`, {
        method: 'POST',
        body: { body, parentCommentId },
      }),
    onSuccess: () => {
      setBody('');
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) send.mutate();
      }}
    >
      <div className="min-w-0 flex-1">
        <MentionInput
          value={body}
          onValueChange={setBody}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          rows={1}
          maxLength={2000}
          className="min-h-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (body.trim()) send.mutate();
            }
          }}
        />
      </div>
      <Button type="submit" disabled={send.isPending || !body.trim()}>
        Send
      </Button>
    </form>
  );
}

function CommentItem({
  c,
  recordId,
  onChange,
}: {
  c: CommentDTO;
  recordId: string;
  onChange: () => void;
}) {
  const { habitatId, me, members } = useHabitat();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const mine = c.author?.id === me.id;
  const names = members.flatMap((m) => [m.name, m.nickname ?? '']).filter(Boolean);

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/habitats/${habitatId}/comments/${c.id}`, { method: 'DELETE' }),
    onSuccess: onChange,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/habitats/${habitatId}/comments/${c.id}`, {
        method: 'PATCH',
        body: { body: draft },
      }),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="flex gap-2">
      <MemberAvatar member={c.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-surface-2 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{displayName(c.author)}</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Comment actions"
                className="rounded p-0.5 text-ink-soft hover:bg-surface"
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {mine && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                )}
                {(mine || isAdmin(me.role)) && (
                  <DropdownMenuItem
                    danger
                    onSelect={() => confirm('Delete this comment?') && remove.mutate()}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
                {!mine && <ReportButton targetType="comment" targetId={c.id} asMenuItem />}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {editing ? (
            <div className="mt-1 space-y-2">
              <MentionInput
                value={draft}
                onValueChange={setDraft}
                rows={2}
                maxLength={2000}
                aria-label="Edit comment"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => save.mutate()}
                  disabled={!draft.trim() || save.isPending}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <RichText text={c.body} names={names} className="text-sm" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-ink-soft">
          <RelativeTime iso={c.createdAt} />
          {c.editedAt && <span>edited</span>}
          {!c.parentCommentId && (
            <button
              type="button"
              className="font-semibold hover:text-ink"
              onClick={() => setReplying((r) => !r)}
            >
              Reply
            </button>
          )}
        </div>
        {replying && (
          <div className="mt-2">
            <CommentForm
              recordId={recordId}
              parentCommentId={c.id}
              placeholder={`Reply to ${displayName(c.author)}…`}
              autoFocus
              onDone={() => {
                setReplying(false);
                onChange();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
