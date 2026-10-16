import Link from 'next/link';
import type { LeaderboardEntry, MyStanding } from '@/lib/leaderboard';
import type { LeaderboardBoard } from '@/lib/validation';

interface Props {
  board: LeaderboardBoard;
  entries: LeaderboardEntry[];
  /** Handle of the current player; their row is highlighted. */
  myHandle?: string;
  /** Shown beneath the table when the player ranks outside the visible entries. */
  outsideTop?: (MyStanding & { handle: string }) | null;
}

function Row({ entry, mine }: { entry: LeaderboardEntry; mine: boolean }) {
  return (
    <tr className={mine ? 'bg-gold font-bold' : undefined} aria-current={mine ? 'true' : undefined}>
      <td className="w-12 py-2.5 pl-3 font-display text-xl tabular-nums">{entry.rank}</td>
      <td className="py-2.5">
        <Link href={`/u/${entry.handle}`} className="underline-offset-2 hover:underline">
          @{entry.handle}
        </Link>
        {mine && <span className="caps ml-2 text-[10px] text-rust">you</span>}
        {entry.playing && (
          <span className="caps ml-2 text-[10px] text-olive" title="Still going">
            <span aria-hidden="true">🔥 </span>live
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right font-display text-xl tabular-nums">{entry.score}</td>
    </tr>
  );
}

export function LeaderboardTable({ board, entries, myHandle, outsideTop }: Props) {
  if (entries.length === 0 && !outsideTop) {
    return (
      <p className="panel p-5 text-center">
        {board === 'today'
          ? 'Nobody has won a Brock today yet. Win one to be first on the board.'
          : 'Nobody is on the board yet. Win a Brock to be first.'}
      </p>
    );
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">
          {board === 'today' ? 'Today’s longest runs' : 'Longest runs of all time'}
        </caption>
        <thead className="caps bg-ink text-[11px] text-paper">
          <tr>
            <th scope="col" className="py-2 pl-3">
              #
            </th>
            <th scope="col" className="py-2">
              Player
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {board === 'today' ? 'Run' : 'Best run'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-ink/20">
          {entries.map((e) => (
            <Row key={e.handle} entry={e} mine={e.handle === myHandle} />
          ))}
          {outsideTop && (
            <>
              <tr aria-hidden>
                <td colSpan={3} className="py-1 text-center">
                  ⋯
                </td>
              </tr>
              <Row
                mine
                entry={{
                  rank: outsideTop.rank,
                  handle: outsideTop.handle,
                  score: outsideTop.score,
                  playing: false,
                }}
              />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
