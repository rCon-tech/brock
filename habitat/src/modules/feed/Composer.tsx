'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ImageUploader } from '@/components/ImageUploader';
import { MemberAvatar } from '@/components/MemberAvatar';
import { MentionInput } from '@/components/MentionInput';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorMessage } from '@/lib/api-client';
import { useHabitat } from '../sdk/context';
import { useCreateRecord } from '../sdk/hooks';

export function Composer() {
  const { me } = useHabitat();
  const [text, setText] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const create = useCreateRecord('feed', 'post');

  function submit() {
    if (!text.trim() && !mediaIds.length) return;
    create.mutate(
      { data: { text, mediaIds } },
      {
        onSuccess: () => {
          setText('');
          setMediaIds([]);
          setResetKey((k) => k + 1);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-3">
        <MemberAvatar member={me} />
        <div className="min-w-0 flex-1">
          <MentionInput
            value={text}
            onValueChange={setText}
            placeholder="What’s happening?"
            aria-label="Write a post"
            maxLength={5000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ImageUploader key={resetKey} max={10} onChange={setMediaIds} />
        <Button onClick={submit} disabled={create.isPending || (!text.trim() && !mediaIds.length)}>
          {create.isPending ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </Card>
  );
}
