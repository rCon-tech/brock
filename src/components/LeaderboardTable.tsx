import Link from 'next/link';
import type { LeaderboardEntry, MyStanding } from '@/lib/leaderboard';

interface Props {
  entries: LeaderboardEntry[];
  /** Handle of the current player; their row is highlighted. */
  myHandle?: string;
  /** Shown beneath the table when the player ranks outside the visible entries. */
  outsideTop?: (MyStanding & { handle: string; bestStreak: number }) | null;
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
      </td>
      <td className="py-2.5 text-right font-display text-xl tabular-nums">{entry.currentStreak}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums opacity-70">{entry.bestStreak}</td>
    </tr>
  );
}

export function LeaderboardTable({ entries, myHandle, outsideTop }: Props) {
  if (entries.length === 0 && !outsideTop) {
    return (
      <p className="panel p-5 text-center">
        Nobody has a streak yet. Win a Brock today to be first on the board.
      </p>
    );
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Global leaderboard by current win streak</caption>
        <thead className="caps bg-ink text-[11px] text-paper">
          <tr>
            <th scope="col" className="py-2 pl-3">
              #
            </th>
            <th scope="col" className="py-2">
              Player
            </th>
            <th scope="col" className="py-2 text-right">
              Streak
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              Best
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
                <td colSpan={4} className="py-1 text-center">
                  ⋯
                </td>
              </tr>
              <Row
                mine
                entry={{
                  rank: outsideTop.rank,
                  handle: outsideTop.handle,
                  currentStreak: outsideTop.streak,
                  bestStreak: outsideTop.bestStreak,
                }}
              />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
