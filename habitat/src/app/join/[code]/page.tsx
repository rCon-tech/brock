import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { JoinButton } from '@/components/JoinButton';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/current-user';
import { DomainError } from '@/lib/errors';
import { previewInvite } from '@/lib/invites';
import { inkFor } from '@/lib/utils';

export const metadata = { title: 'Join a Habitat', robots: { index: false } };

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  const preview = await previewInvite(code).catch((e) => (e instanceof DomainError ? e : Promise.reject(e)));

  if (preview instanceof DomainError) {
    return (
      <Shell>
        <div aria-hidden className="text-5xl">
          🔒
        </div>
        <h1 className="text-xl font-bold">{preview.status === 410 ? 'This invite has expired' : 'We can’t find that invite'}</h1>
        <p className="text-ink-soft">Ask your friend for a fresh link.</p>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </Shell>
    );
  }

  const next = `/join/${code}`;
  // New accounts finish the welcome step first, then come straight back here.
  if (user && !user.onboardedAt) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return (
    <Shell>
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl" style={{ background: preview.accent, color: inkFor(preview.accent) }} aria-hidden>
        {preview.emoji}
      </span>
      <h1 className="text-2xl font-extrabold">You’re invited to {preview.name}</h1>
      <p className="text-ink-soft">
        {preview.memberCount} {preview.memberCount === 1 ? 'person is' : 'people are'} in here. It’s private: only members can see anything.
      </p>
      {preview.full ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">This Habitat is full right now.</p>
      ) : user ? (
        <JoinButton code={code} name={preview.name} />
      ) : (
        <Button asChild size="lg" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in to join</Link>
        </Button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      {children}
    </main>
  );
}
