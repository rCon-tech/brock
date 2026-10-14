'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn, signOut } from '@/lib/auth-client';

interface Props {
  providers: { google: boolean; github: boolean };
}

const buttonClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brock-line bg-brock-card px-4 py-3 text-base font-semibold transition hover:border-brock-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brock-accent disabled:opacity-60';

export function SignInButtons({ providers }: Props) {
  const [pending, setPending] = useState<'google' | 'github' | null>(null);

  async function go(provider: 'google' | 'github') {
    setPending(provider);
    try {
      await signIn.social({ provider, callbackURL: '/' });
    } finally {
      setPending(null);
    }
  }

  if (!providers.google && !providers.github) {
    return (
      <p className="rounded-xl border border-brock-line bg-brock-card p-4 text-sm text-brock-muted">
        No sign-in providers are configured. Set <code>GITHUB_CLIENT_ID</code> /{' '}
        <code>GOOGLE_CLIENT_ID</code> and their secrets in <code>.env</code>.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:max-w-xs">
      {providers.github && (
        <button className={buttonClass} disabled={pending !== null} onClick={() => go('github')}>
          Continue with GitHub
        </button>
      )}
      {providers.google && (
        <button className={buttonClass} disabled={pending !== null} onClick={() => go('google')}>
          Continue with Google
        </button>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="whitespace-nowrap rounded-lg px-1.5 py-1 text-sm text-brock-muted hover:text-brock-text focus-visible:outline-2 focus-visible:outline-brock-accent"
      onClick={async () => {
        await signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
