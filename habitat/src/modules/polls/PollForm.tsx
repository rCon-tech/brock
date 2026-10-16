'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useCreateRecord } from '../sdk/hooks';

export function PollForm({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('polls', 'poll');
  const cleaned = options.map((o) => o.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ask the group">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { data: { question, options: cleaned, multiple, closesAt: closesAt ? new Date(closesAt).toISOString() : undefined } },
              {
                onSuccess: (r) => {
                  onOpenChange(false);
                  onCreated?.(r.id);
                },
                onError: (err) => (err instanceof ApiError && err.fields ? setFields(err.fields) : toast.error(errorMessage(err))),
              },
            );
          }}
        >
          <div>
            <Label htmlFor="pq">Question</Label>
            <Input id="pq" required maxLength={200} placeholder="Where shall we eat?" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <FieldError messages={fields.question} />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label={`Option ${i + 1}`} maxLength={100} value={o} placeholder={`Option ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
            <FieldError messages={fields.options} />
            {options.length < 10 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ''])}>
                <Plus size={14} /> Add option
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Allow more than one choice
          </label>
          <div>
            <Label htmlFor="pc">Closes (optional)</Label>
            <Input id="pc" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending || !question.trim() || cleaned.length < 2}>
              Ask
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
