import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionButton } from '@/components/ActionButton';
import { SaveWithGoogle } from '@/components/SaveWithGoogle';
import { googleEnabled } from '@/lib/auth';
import { getSessionUser } from '@/lib/session';
import { deleteMyDataAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Your account</h2>
        {user.isAnonymous ? (
          <>
            <p className="text-sm text-muted">
              You’re using Hearth as a guest. Your rooms live in this browser. Sign in with Google
              to keep them safe and use them on any device. Nothing you’ve done is lost.
            </p>
            {googleEnabled ? (
              <SaveWithGoogle />
            ) : (
              <p className="text-xs text-muted">Google sign-in isn’t set up on this site yet.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Signed in as {user.name}.</p>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Your data</h2>
        <p className="text-sm text-muted">
          Download everything Hearth holds about you, or delete it all.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" className="btn btn-secondary">
            Download my data
          </a>
          <ActionButton
            className="btn btn-danger"
            confirm="Delete your account and everything you added? Rooms you started will carry on for the others if anyone is in them. This can’t be undone."
            action={deleteMyDataAction}
          >
            Delete my data
          </ActionButton>
        </div>
      </section>
    </div>
  );
}
