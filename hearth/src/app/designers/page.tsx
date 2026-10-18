import type { Metadata } from 'next';
import { DesignersForm } from '@/components/DesignersForm';

export const metadata: Metadata = { title: 'For designers' };

export default function Designers() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">Hearth for designers</h1>
      <p className="text-muted">
        Do your clients disagree about style? Imagine sending them a link, and getting back a shared
        style, a palette and a shortlist before your first meeting.
      </p>
      <p className="rounded-xl bg-blush p-3 text-sm">
        This isn’t available yet. We’re finding out whether it would be useful. Leave your details
        and tell us what you’d need, and we’ll be in touch. There’s nothing to pay.
      </p>
      <DesignersForm />
    </div>
  );
}
