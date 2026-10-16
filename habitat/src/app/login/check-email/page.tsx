import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Check your email' };

export default async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo size="lg" />
      <div aria-hidden className="text-5xl">
        📬
      </div>
      <h1 className="text-xl font-bold">Check your inbox</h1>
      <p className="text-ink-soft">
        We sent a sign-in link
        {email ? (
          <>
            {' '}
            to <strong className="text-ink">{email}</strong>
          </>
        ) : null}
        . It works once and expires in 10 minutes.
      </p>
      <Link href="/login" className="text-sm text-accent underline">
        Use a different email
      </Link>
    </main>
  );
}
