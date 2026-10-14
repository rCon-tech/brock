import { LeaderboardTable } from '@/components/LeaderboardTable';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { getCurrentPlayer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard' };

const LIMIT = 100;

export default async function LeaderboardPage() {
  const [entries, me] = await Promise.all([
    topPlayers(LIMIT),
    getCurrentPlayer().catch(() => null),
  ]);
  const myHandle = me?.handle ?? undefined;

  let outsideTop = null;
  if (me?.handle && !entries.some((e) => e.handle === myHandle)) {
    const standing = await rankOf(me.id);
    if (standing) {
      outsideTop = {
        ...standing,
        handle: me.handle,
        bestStreak: me.bestStreak,
      };
    }
  }

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="comic-heading -rotate-2 text-6xl">LEADERBOARD</h1>
        <p className="tagline">Miss a day and your streak is gone</p>
      </div>
      <LeaderboardTable entries={entries} myHandle={myHandle} outsideTop={outsideTop} />
    </section>
  );
}
