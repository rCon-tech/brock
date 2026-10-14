import Link from 'next/link';
import { BrockGame } from '@/components/BrockGame';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { topPlayers } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const top = await topPlayers(5);

  return (
    <div className="flex flex-col gap-10">
      <BrockGame />

      <section className="flex flex-col gap-3" aria-labelledby="top-title">
        <div className="flex items-baseline justify-between">
          <h2 id="top-title" className="text-xl font-extrabold">
            Longest streaks
          </h2>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-brock-accent hover:underline"
          >
            Full leaderboard →
          </Link>
        </div>
        <LeaderboardTable entries={top} />
      </section>
    </div>
  );
}
