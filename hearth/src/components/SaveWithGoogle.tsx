'use client';

import { authClient } from '@/lib/auth-client';

/** A guest keeps everything they've done when they sign in (R3). */
export function SaveWithGoogle() {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/projects' })}
    >
      Save with Google
    </button>
  );
}
