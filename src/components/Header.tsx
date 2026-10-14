import Link from 'next/link';
import { getViewer } from '@/lib/session';
import { SignOutButton } from './SignInButtons';

const navLink =
  'whitespace-nowrap rounded-lg px-1.5 py-1 text-sm text-brock-muted hover:text-brock-text focus-visible:outline-2 focus-visible:outline-brock-accent';

export async function Header() {
  const viewer = await getViewer().catch(() => ({ state: 'signed_out' }) as const);

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
          {viewer.state === 'player' && (
            <>
              <Link href={`/u/${viewer.player.handle}`} className={`${navLink} inline-block max-w-28 truncate font-semibold`}>
                @{viewer.player.handle}
              </Link>
              <SignOutButton />
            </>
          )}
          {viewer.state === 'needs_handle' && <SignOutButton />}
        </nav>
      </div>
    </header>
  );
}
