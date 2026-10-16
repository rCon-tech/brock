import Link from 'next/link';
import { Users } from 'lucide-react';
import { inkFor } from '@/lib/utils';

export interface HabitatCardData {
  slug: string;
  name: string;
  emoji: string;
  accent: string;
  memberCount: number;
}

export function HabitatCard({ h }: { h: HabitatCardData }) {
  return (
    <Link
      href={`/h/${h.slug}`}
      className="group flex flex-col gap-6 rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
        style={{ background: h.accent, color: inkFor(h.accent) }}
        aria-hidden
      >
        {h.emoji}
      </span>
      <span>
        <span className="block text-lg font-bold leading-tight">{h.name}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-sm text-ink-soft">
          <Users size={14} /> {h.memberCount} {h.memberCount === 1 ? 'person' : 'people'}
        </span>
      </span>
    </Link>
  );
}
