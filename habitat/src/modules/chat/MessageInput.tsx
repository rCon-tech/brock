'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ImageUploader } from '@/components/ImageUploader';
import { useRealtime } from '@/components/RealtimeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useCreateRecord } from '../sdk/hooks';

export function MessageInput() {
  const [text, setText] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const { sendTyping } = useRealtime();
  const create = useCreateRecord('chat', 'message');

  function send() {
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
    <form
      className="space-y-2 border-t border-line bg-background pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <ImageUploader key={resetKey} max={4} onChange={setMediaIds} label="Photo" />
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          rows={1}
          maxLength={2000}
          aria-label="Message"
          placeholder="Message…"
          className="min-h-10 flex-1 resize-none"
          onChange={(e) => {
            setText(e.target.value);
            sendTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={create.isPending || (!text.trim() && !mediaIds.length)}
        >
          <Send size={18} />
        </Button>
      </div>
    </form>
  );
}
