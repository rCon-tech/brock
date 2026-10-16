import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HabitatNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div aria-hidden className="text-5xl">
        🌫️
      </div>
      <h1 className="text-xl font-bold">We can’t find that</h1>
      <p className="text-ink-soft">It may have been removed, or it isn’t part of this Habitat.</p>
      <Button asChild variant="outline">
        <Link href="/">Back to your Habitats</Link>
      </Button>
    </div>
  );
}
