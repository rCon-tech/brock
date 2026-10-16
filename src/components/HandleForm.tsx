'use client';

import { useState } from 'react';

interface Props {
  onNamed: (handle: string) => void;
}

const MESSAGES: Record<string, string> = {
  handle_taken: 'Handle taken. Try another.',
  invalid_request: 'Use 3–20 letters, numbers or underscores.',
  rate_limited: 'Slow down a moment and try again.',
};

/** Shown after a finished run so the score can go on the leaderboard. */
export function HandleForm({ onNamed }: Props) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = String(new FormData(event.currentTarget).get('handle') ?? '').trim();
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/player/handle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(MESSAGES[data.error] ?? 'Something went wrong. Please try again.');
        return;
      }
      onNamed(data.handle);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="handle" className="font-display text-2xl tracking-wide text-rust">
        Add your name to the leaderboard
      </label>
      <div className="flex gap-2">
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
          className="field flex-1"
        />
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? 'SAVING…' : 'SAVE'}
        </button>
      </div>
      <p id="handle-help" className="text-sm">
        3–20 letters, numbers or underscores. No account needed: this browser remembers you, and on
        another device you just log in with this name.
      </p>
      <p id="handle-error" role="alert" className="min-h-5 text-sm font-bold text-rust">
        {error}
      </p>
    </form>
  );
}
