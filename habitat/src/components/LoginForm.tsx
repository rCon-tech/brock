'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function LoginForm({ next, google, invited }: { next: string; google: boolean; invited: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: next });
    setBusy(false);
    if (error) return setError(error.message ?? 'We couldn’t send that link. Try again in a minute.');
    router.push(`/login/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="space-y-4">
      {invited && <p className="rounded-xl bg-accent/15 p-3 text-sm">Sign in to join your friends. We’ll bring you straight back.</p>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
      {google && (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="outline" size="lg" className="w-full" onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}>
            Continue with Google
          </Button>
        </>
      )}
      <p className="text-center text-xs text-ink-soft">No password to remember. New here? This creates your account.</p>
    </div>
  );
}
