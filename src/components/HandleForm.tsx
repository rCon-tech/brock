'use client';

import { useActionState } from 'react';
import { claimHandleAction, type HandleFormState } from '@/app/onboarding/actions';

export function HandleForm() {
  const [state, action, pending] = useActionState<HandleFormState, FormData>(claimHandleAction, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="handle" className="text-sm font-semibold">
        Your handle
      </label>
      <input
        id="handle"
        name="handle"
        required
        minLength={3}
        maxLength={20}
        pattern="[a-zA-Z0-9_]{3,20}"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby="handle-help handle-error"
        className="rounded-xl border border-brock-line bg-brock-card px-4 py-3 text-base outline-none focus:border-brock-accent"
      />
      <p id="handle-help" className="text-sm text-brock-muted">
        3–20 letters, numbers or underscores. This is what shows on the leaderboard.
      </p>
      <p id="handle-error" role="alert" className="min-h-5 text-sm text-brock-loss">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brock-accent px-4 py-3 text-base font-bold text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Start Brocking'}
      </button>
    </form>
  );
}
