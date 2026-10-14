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
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-extrabold">Leaderboard</h1>
        <p className="mt-1 text-brock-muted">
          Ranked by current streak. Miss a day and yours is gone.
        </p>
      </div>
      <LeaderboardTable entries={entries} myHandle={myHandle} outsideTop={outsideTop} />
    </section>
  );
}
