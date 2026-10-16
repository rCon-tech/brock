import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { LoginForm } from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/current-user';
import { safeNext } from '@/lib/safe-next';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Logo size="lg" />
        <h1 className="mt-6 text-xl font-bold">Sign in or create your account</h1>
      </div>
      <LoginForm
        next={next}
        google={!!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET}
        invited={next.startsWith('/join/')}
      />
    </main>
  );
}
