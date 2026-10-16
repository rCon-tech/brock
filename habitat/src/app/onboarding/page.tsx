import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { OnboardingForm } from '@/components/OnboardingForm';
import { requireUser } from '@/lib/current-user';
import { safeNext } from '@/lib/safe-next';

export const metadata = { title: 'Welcome' };

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser({ allowUnonboarded: true });
  const next = safeNext((await searchParams).next);
  if (user.onboardedAt) redirect(next);
  const guess = user.name && !user.name.includes('@') ? user.name : '';
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Logo size="lg" />
        <h1 className="mt-6 text-xl font-bold">Welcome 👋</h1>
        <p className="mt-1 text-ink-soft">One quick thing before you go in.</p>
      </div>
      <OnboardingForm initialName={guess} next={next} />
    </main>
  );
}
