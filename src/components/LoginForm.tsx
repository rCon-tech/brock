'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MESSAGES: Record<string, string> = {
  not_found: 'No player with that name. Check the spelling, or play first and pick a name.',
  rate_limited: 'Too many attempts. Try again in a few minutes.',
  invalid_request: 'Enter your username.',
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = String(new FormData(event.currentTarget).get('handle') ?? '');
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/player/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(MESSAGES[data.error] ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="handle" className="caps text-xs">
        Your username
      </label>
      <input
        id="handle"
        name="handle"
        required
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        className="field"
      />
      <p role="alert" className="min-h-5 text-sm font-bold text-rust">
        {error}
      </p>
      <button type="submit" disabled={pending} className="btn-ink">
        {pending ? 'LOGGING IN…' : 'LOG IN'}
      </button>
    </form>
  );
}
