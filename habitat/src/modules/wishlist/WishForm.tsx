'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, Label, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useCreateRecord } from '../sdk/hooks';

export function WishForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('wishlist', 'wish');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a wish" description="Your friends will see it, and can claim it secretly. You won’t see who has.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { data: { title, link: link.trim() || undefined, price: price.trim() || undefined, note: note.trim() || undefined } },
              {
                onSuccess: () => onOpenChange(false),
                onError: (err) => (err instanceof ApiError && err.fields ? setFields(err.fields) : toast.error(errorMessage(err))),
              },
            );
          }}
        >
          <div>
            <Label htmlFor="wt">What would you love?</Label>
            <Input id="wt" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            <FieldError messages={fields.title} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wl">Link (optional)</Label>
              <Input id="wl" type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
              <FieldError messages={fields.link} />
            </div>
            <div>
              <Label htmlFor="wp">Rough price (optional)</Label>
              <Input id="wp" maxLength={20} placeholder="£25" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="wn">Notes (optional)</Label>
            <Textarea id="wn" maxLength={500} placeholder="Size, colour…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
