'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, Label, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useCreateRecord, useUpdateRecord } from '../sdk/hooks';

export interface EventData {
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  details?: string;
}

const toLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

export function EventForm({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: { id: string; data: EventData };
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState(existing?.data.title ?? '');
  const [startsAt, setStartsAt] = useState(toLocal(existing?.data.startsAt));
  const [endsAt, setEndsAt] = useState(toLocal(existing?.data.endsAt));
  const [location, setLocation] = useState(existing?.data.location ?? '');
  const [details, setDetails] = useState(existing?.data.details ?? '');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('events', 'event');
  const update = useUpdateRecord('events');
  const busy = create.isPending || update.isPending;

  function submit() {
    const data = { title, startsAt: toIso(startsAt), endsAt: toIso(endsAt), location, details };
    const opts = {
      onSuccess: (r: { id: string }) => {
        onOpenChange(false);
        onSaved?.(r.id);
      },
      onError: (e: unknown) => {
        if (e instanceof ApiError && e.fields) setFields(e.fields);
        else toast.error(errorMessage(e));
      },
    };
    if (existing) update.mutate({ id: existing.id, data }, opts);
    else create.mutate({ data }, opts);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={existing ? 'Edit event' : 'Plan something'}
        description="Everyone in the Habitat will be told."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div>
            <Label htmlFor="et">What’s the plan?</Label>
            <Input
              id="et"
              required
              maxLength={100}
              placeholder="Pub quiz"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldError messages={fields.title} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="es">Starts</Label>
              <Input
                id="es"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
              <FieldError messages={fields.startsAt} />
            </div>
            <div>
              <Label htmlFor="ee">Ends (optional)</Label>
              <Input
                id="ee"
                type="datetime-local"
                min={startsAt}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="el">Where (optional)</Label>
            <Input
              id="el"
              maxLength={200}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ed">Details (optional)</Label>
            <Textarea
              id="ed"
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !title.trim() || !startsAt}>
              {existing ? 'Save' : 'Create event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
