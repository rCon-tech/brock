import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SaveWithGoogle } from '@/components/SaveWithGoogle';
import { googleEnabled } from '@/lib/auth';
import { getSessionUser } from '@/lib/session';

export async function Header() {
  const user = await getSessionUser();
  return (
    <header className="no-print border-b border-sand bg-cream/90 backdrop-blur">
      <div className="gutter mx-auto flex h-14 max-w-2xl items-center justify-between">
        <Link href="/" aria-label="Hearth home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              <Link href="/projects" className="btn btn-ghost btn-sm">
                My rooms
              </Link>
              <Link href="/settings" className="btn btn-ghost btn-sm">
                Settings
              </Link>
              {user.isAnonymous && googleEnabled ? <SaveWithGoogle /> : null}
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
