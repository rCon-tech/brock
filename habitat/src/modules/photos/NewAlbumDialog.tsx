'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FieldError, Input, Label, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useCreateRecord } from '../sdk/hooks';

export function NewAlbumDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('photos', 'album');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New album
        </Button>
      </DialogTrigger>
      <DialogContent title="New album" description="Anyone in the Habitat can add photos to it.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { data: { title, description } },
              {
                onSuccess: (r) => {
                  setOpen(false);
                  setTitle('');
                  setDescription('');
                  onCreated?.(r.id);
                },
                onError: (err) => {
                  if (err instanceof ApiError && err.fields) setFields(err.fields);
                  else toast.error(errorMessage(err));
                },
              },
            );
          }}
        >
          <div>
            <Label htmlFor="at">Title</Label>
            <Input
              id="at"
              required
              maxLength={80}
              placeholder="Lisbon 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldError messages={fields.title} />
          </div>
          <div>
            <Label htmlFor="ad">Description (optional)</Label>
            <Textarea
              id="ad"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              Create album
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
