import Link from 'next/link';
import { getCurrentPlayer } from '@/lib/session';

const navLink =
  'caps whitespace-nowrap border-b-2 border-transparent pb-0.5 text-xs tracking-[0.06em] text-paper hover:border-gold sm:tracking-[0.12em]';

export async function Header() {
  // The header must never take the page down, so a database hiccup just hides the handle.
  const player = await getCurrentPlayer().catch(() => null);

  return (
    <header className="border-b-4 border-ink bg-olive text-paper">
      <div className="gutter mx-auto flex w-full max-w-2xl items-center justify-between gap-3 py-2.5">
        <Link href="/" className="flex min-w-0 flex-col leading-tight">
          <span className="caps text-[15px] tracking-[0.3em]">BROCK</span>
          <span className="hidden font-slab text-xs tracking-[0.12em] text-gold [font-variant:small-caps] min-[400px]:block">
            Daily rock paper scissors
          </span>
        </Link>
        <nav className="flex min-w-0 items-center gap-3 sm:gap-3.5" aria-label="Main">
          <Link href="/" className={`${navLink} hidden sm:inline-block`}>
            Play
          </Link>
          <Link href="/leaderboard" className={navLink}>
            Leaderboard
          </Link>
          {player?.handle ? (
            <Link
              href={`/u/${player.handle}`}
              className={`${navLink} inline-block max-w-28 truncate normal-case tracking-[0.06em]`}
            >
              @{player.handle}
            </Link>
          ) : (
            <Link href="/login" className={navLink}>
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
