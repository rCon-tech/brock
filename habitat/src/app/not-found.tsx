import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div aria-hidden className="text-5xl">
        🌫️
      </div>
      <h1 className="text-2xl font-bold">We can’t find that</h1>
      <p className="text-ink-soft">It may not exist, or it may belong to a group you’re not in.</p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
