import Link from 'next/link';
import { BrockGame } from '@/components/BrockGame';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Logo } from '@/components/Logo';
import { topPlayers } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const top = await topPlayers('today', 5);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <Logo />
        <p className="tagline">One run a day</p>
      </div>

      <BrockGame />

      <section className="flex w-full flex-col gap-3 pt-4" aria-labelledby="top-title">
        <div className="flex items-end justify-between gap-3">
          <h2 id="top-title" className="comic-heading text-4xl">
            TODAY’S TOP RUNS
          </h2>
          <Link href="/leaderboard" className="caps shrink-0 text-xs underline underline-offset-4">
            Full leaderboard
          </Link>
        </div>
        <LeaderboardTable board="today" entries={top} />
      </section>
    </>
  );
}
