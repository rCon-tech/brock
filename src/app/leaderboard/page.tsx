import { LeaderboardTable } from '@/components/LeaderboardTable';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard' };

const LIMIT = 100;

export default async function LeaderboardPage() {
  const [entries, viewer] = await Promise.all([topPlayers(LIMIT), getViewer()]);
  const myHandle = viewer.state === 'player' ? viewer.player.handle : undefined;

  let outsideTop = null;
  if (viewer.state === 'player' && !entries.some((e) => e.handle === myHandle)) {
    const standing = await rankOf(viewer.player.userId);
    if (standing) {
      outsideTop = {
        ...standing,
        handle: viewer.player.handle,
        bestStreak: viewer.player.bestStreak,
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
