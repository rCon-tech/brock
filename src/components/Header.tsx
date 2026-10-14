import Link from 'next/link';
import { getCurrentPlayer } from '@/lib/session';

const navLink =
  'whitespace-nowrap rounded-lg px-1.5 py-1 text-sm text-brock-muted hover:text-brock-text focus-visible:outline-2 focus-visible:outline-brock-accent';

export async function Header() {
  // The header must never take the page down, so a database hiccup just hides the handle.
  const player = await getCurrentPlayer().catch(() => null);

  return (
    <header className="border-b border-brock-line">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="shrink-0 whitespace-nowrap text-lg font-extrabold tracking-tight">
          🪨 Brock
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5" aria-label="Main">
          <Link href="/" className={`${navLink} hidden sm:inline-block`}>
            Play
          </Link>
          <Link href="/leaderboard" className={navLink}>
            Leaderboard
          </Link>
          {player?.handle ? (
            <Link
              href={`/u/${player.handle}`}
              className={`${navLink} inline-block max-w-28 truncate font-semibold`}
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
