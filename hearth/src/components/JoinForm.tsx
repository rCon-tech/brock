'use client';

import { useActionState } from 'react';
import { joinAction, type JoinState } from '@/app/j/[token]/actions';

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your first name
        <input
          name="displayName"
          required
          maxLength={40}
          autoComplete="given-name"
          className="field font-normal"
          autoFocus
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-blush p-3 text-sm text-clay-dark">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Joining…' : 'Start swiping'}
      </button>
      <p className="text-xs text-muted">No account needed. About 3 minutes.</p>
    </form>
  );
}
