'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RecoveryCode } from './RecoveryCode';

const MESSAGES: Record<string, string> = {
  invalid_recovery: 'That handle and code don’t match.',
  rate_limited: 'Too many attempts. Try again in 15 minutes.',
  invalid_request: 'Enter your handle and recovery code.',
};

export function RecoverForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [restored, setRestored] = useState<{ handle: string; code: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/player/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: form.get('handle'), code: form.get('code') }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(MESSAGES[data.error] ?? 'Something went wrong. Please try again.');
        return;
      }
      setRestored({ handle: data.handle, code: data.recoveryCode });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (restored) {
    return (
      <RecoveryCode
        heading={`Welcome back, @${restored.handle}`}
        code={restored.code}
        onDone={() => {
          router.push('/');
          router.refresh();
        }}
      />
    );
  }

  const input =
    'rounded-xl border border-brock-line bg-brock-card px-4 py-3 text-base outline-none focus:border-brock-accent';

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="handle" className="text-sm font-semibold">
        Handle
      </label>
      <input
        id="handle"
        name="handle"
        required
        autoComplete="off"
        autoCapitalize="none"
        className={input}
      />
      <label htmlFor="code" className="text-sm font-semibold">
        Recovery code
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        className={`${input} font-mono`}
      />
      <p role="alert" className="min-h-5 text-sm text-brock-loss">
        {error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brock-accent px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Restoring…' : 'Restore my streak'}
      </button>
    </form>
  );
}
