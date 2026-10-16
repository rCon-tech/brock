import Link from 'next/link';
import type { LeaderboardBoard } from '@/lib/validation';

const TABS: { board: LeaderboardBoard; label: string; href: string }[] = [
  { board: 'today', label: 'Today', href: '/leaderboard' },
  { board: 'all', label: 'All-time', href: '/leaderboard?board=all' },
];

/** Today / All-time switch. Plain links, so each board has its own URL. */
export function BoardTabs({ current }: { current: LeaderboardBoard }) {
  return (
    <nav aria-label="Leaderboards" className="flex justify-center gap-3">
      {TABS.map((t) => (
        <Link
          key={t.board}
          href={t.href}
          aria-current={t.board === current ? 'page' : undefined}
          className="btn-paper"
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
