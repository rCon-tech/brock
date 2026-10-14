import Link from 'next/link';
import { getViewer } from '@/lib/session';
import { SignOutButton } from './SignInButtons';

const navLink =
  'rounded-lg px-2 py-1 text-sm text-brock-muted hover:text-brock-text focus-visible:outline-2 focus-visible:outline-brock-accent';

export async function Header() {
  const viewer = await getViewer().catch(() => ({ state: 'signed_out' }) as const);

  return (
    <header className="border-b border-brock-line">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          🪨 Brock
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link href="/" className={navLink}>
            Play
          </Link>
          <Link href="/leaderboard" className={navLink}>
            Leaderboard
          </Link>
          {viewer.state === 'player' && (
            <>
              <Link href={`/u/${viewer.player.handle}`} className={`${navLink} font-semibold`}>
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
