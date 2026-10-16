import type { CurrentUser } from '@/lib/current-user';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';

export function SiteHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <UserMenu name={user.name} email={user.email} image={user.image} />
        </div>
      </div>
    </header>
  );
}
