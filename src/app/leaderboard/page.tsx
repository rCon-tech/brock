import { BoardTabs } from '@/components/BoardTabs';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { rankOf, topPlayers } from '@/lib/leaderboard';
import { getCurrentPlayer } from '@/lib/session';
import { LeaderboardBoard } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard' };

const LIMIT = 100;

type Props = { searchParams: Promise<{ board?: string }> };

export default async function LeaderboardPage({ searchParams }: Props) {
  const board = LeaderboardBoard.parse((await searchParams).board);
  const [entries, me] = await Promise.all([
    topPlayers(board, LIMIT),
    getCurrentPlayer().catch(() => null),
  ]);
  const myHandle = me?.handle ?? undefined;

  let outsideTop = null;
  if (me?.handle && !entries.some((e) => e.handle === myHandle)) {
    const standing = await rankOf(me.id, board);
    if (standing) outsideTop = { ...standing, handle: me.handle };
  }

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="comic-heading -rotate-2 text-6xl">LEADERBOARD</h1>
        <p className="tagline">
          {board === 'today' ? 'Today’s longest runs · resets at midnight UTC' : 'Best runs ever'}
        </p>
      </div>
      <BoardTabs current={board} />
      <LeaderboardTable
        board={board}
        entries={entries}
        myHandle={myHandle}
        outsideTop={outsideTop}
      />
    </section>
  );
}
