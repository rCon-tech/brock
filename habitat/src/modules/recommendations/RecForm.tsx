'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCreateRecord } from '../sdk/hooks';
import { KINDS } from './RecCard';

export function RecForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [kind, setKind] = useState('film');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('recommendations', 'rec');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Recommend something">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              {
                data: {
                  kind,
                  title,
                  link: link.trim() || undefined,
                  note: note.trim() || undefined,
                  rating: rating || undefined,
                },
              },
              {
                onSuccess: () => onOpenChange(false),
                onError: (err) =>
                  err instanceof ApiError && err.fields
                    ? setFields(err.fields)
                    : toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="rk">Kind</Label>
              <Select id="rk" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="rt">Title</Label>
              <Input
                id="rt"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <FieldError messages={fields.title} />
            </div>
          </div>
          <div>
            <Label htmlFor="rl">Link (optional)</Label>
            <Input
              id="rl"
              type="url"
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <FieldError messages={fields.link} />
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setRating(rating === n ? 0 : n)}
                >
                  <Star
                    size={28}
                    className={cn(n <= rating ? 'fill-accent text-accent' : 'text-line')}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="rn">Why? (optional)</Label>
            <Textarea
              id="rn"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              Share
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
