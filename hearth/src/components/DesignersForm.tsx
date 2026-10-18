'use client';

import { useActionState } from 'react';
import { waitlistAction, type WaitlistState } from '@/app/designers/actions';

export function DesignersForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(waitlistAction, {});
  if (state.done) {
    return (
      <p role="status" className="rounded-xl bg-sage-soft p-4">
        Thanks! We’ll be in touch. Nothing is needed from you yet and nothing has been charged.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="feature" value="designers" />
      {(
        [
          ['email', 'Email', 'email'],
          ['practiceSize', 'Practice size (just you, or how many?)', 'text'],
          ['clientsPerMonth', 'New clients per month', 'text'],
          ['wouldPay', 'What would this be worth to you?', 'text'],
        ] as const
      ).map(([name, label, type]) => (
        <label key={name} className="flex flex-col gap-1 text-sm font-semibold">
          {label}
          <input
            name={name}
            type={type}
            required={name === 'email'}
            className="field font-normal"
          />
        </label>
      ))}
      {state.error ? (
        <p role="alert" className="text-sm text-clay-dark">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary self-start" disabled={pending}>
        Tell me more
      </button>
    </form>
  );
}
