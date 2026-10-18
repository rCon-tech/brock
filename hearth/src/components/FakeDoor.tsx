'use client';

import { useActionState, useState } from 'react';
import { waitlistAction, type WaitlistState } from '@/app/designers/actions';

/**
 * "See it in your room" is not built yet. This asks for interest, plainly says so, and takes no
 * payment details (§5): it exists to learn whether people would want it.
 */
export function FakeDoor({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WaitlistState, FormData>(waitlistAction, {});

  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="in-room">
      <h2 id="in-room" className="text-lg font-bold">
        See it in your room
      </h2>
      <p className="text-sm text-muted">
        Upload a photo of your room and see these pieces in it. We’re still building this, and we
        expect to charge a few pounds for it.
      </p>
      {state.done ? (
        <p role="status" className="rounded-xl bg-sage-soft p-3 text-sm">
          Thanks! We’ll email you when it’s ready. Nothing has been charged and nothing else is
          needed.
        </p>
      ) : open ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="feature" value="see_in_room" />
          <input type="hidden" name="projectId" value={projectId} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Your email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="field font-normal"
            />
          </label>
          {state.error ? (
            <p role="alert" className="text-xs text-clay-dark">
              {state.error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary self-start" disabled={pending}>
            Tell me when it’s ready
          </button>
          <p className="text-xs text-muted">
            This isn’t available yet, so there’s nothing to pay for. We’ll only email about this.
          </p>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-secondary self-start"
          onClick={() => setOpen(true)}
        >
          I’d like that
        </button>
      )}
    </section>
  );
}
