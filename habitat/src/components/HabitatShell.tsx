'use client';

import { useQuery } from '@tanstack/react-query';
import { Home, Menu, Puzzle, Settings, Users, Vote } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HabitatSwitcher } from '@/components/HabitatSwitcher';
import { ModuleIcon } from '@/components/ModuleIcon';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import type { ProposalDTO } from '@/lib/proposals';
import { cn } from '@/lib/utils';
import { isAdmin, useHabitat } from '@/modules/sdk/context';
import type { Role } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  match?: (path: string) => boolean;
}

export function HabitatShell({
  habitat,
  user,
  role,
  nav,
  children,
}: {
  habitat: { slug: string; name: string; emoji: string; accent: string };
  user: { name: string; email: string; image: string | null };
  role: Role;
  nav: Array<{ id: string; label: string; icon: string }>;
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { habitatId } = useHabitat();
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/h/${habitat.slug}`;

  // A vote finishing elsewhere can add or remove modules: re-read the nav from the server.
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener('habitat:modules-changed', refresh);
    return () => window.removeEventListener('habitat:modules-changed', refresh);
  }, [router]);

  const { data: open } = useQuery({
    queryKey: ['habitat', habitatId, 'proposals', 'open'],
    queryFn: () => apiFetch<{ proposals: ProposalDTO[] }>(`/api/habitats/${habitatId}/proposals?status=open`),
    refetchInterval: 20_000,
  });
  const waiting = (open?.proposals ?? []).filter((p) => !p.myVote).length;

  // Without a live connection, notice a vote ending (it may have added or removed a module) and re-read the nav.
  const openIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!open) return;
    const now = new Set(open.proposals.map((p) => p.id));
    const before = openIds.current;
    openIds.current = now;
    if (before && [...before].some((id) => !now.has(id))) router.refresh();
  }, [open, router]);

  const items: NavItem[] = [
    { href: base, label: 'Home', icon: <Home size={20} />, match: (p) => p === base },
    ...nav.map((n) => ({
      href: `${base}/m/${n.id}`,
      label: n.label,
      icon: <ModuleIcon name={n.icon} />,
      match: (p: string) => p.startsWith(`${base}/m/${n.id}`),
    })),
    { href: `${base}/members`, label: 'Members', icon: <Users size={20} /> },
    { href: `${base}/library`, label: 'Library', icon: <Puzzle size={20} /> },
    { href: `${base}/proposals`, label: 'Votes', icon: <Vote size={20} />, badge: waiting },
    ...(isAdmin(role) ? [{ href: `${base}/settings`, label: 'Settings', icon: <Settings size={20} /> }] : []),
  ];
  const active = (i: NavItem) => (i.match ? i.match(path) : path.startsWith(i.href));
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const moreActive = rest.some(active);

  const link = (i: NavItem, mobile = false) => (
    <Link
      key={i.href}
      href={i.href}
      onClick={() => setMoreOpen(false)}
      aria-current={active(i) ? 'page' : undefined}
      className={cn(
        mobile
          ? 'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold'
          : 'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold',
        active(i) ? (mobile ? 'text-accent' : 'bg-accent/15 text-ink') : 'text-ink-soft hover:bg-surface-2',
      )}
    >
      {i.icon}
      <span>{i.label}</span>
      {!!i.badge && (
        <span className={cn('rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink', mobile ? 'absolute right-[22%] top-1' : 'ml-auto')}>{i.badge}</span>
      )}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line p-3 md:flex">
        <div className="mb-2 px-1">
          <HabitatSwitcher current={habitat} />
        </div>
        <nav aria-label="Habitat" className="flex flex-col gap-1">
          {items.map((i) => link(i))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-background/90 px-3 backdrop-blur">
          <div className="md:invisible">
            <HabitatSwitcher current={habitat} />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-3 py-4 pb-24 md:px-6 md:pb-8">{children}</main>
      </div>

      <nav aria-label="Habitat" className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-background/95 backdrop-blur md:hidden">
        {primary.map((i) => link(i, true))}
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', moreActive ? 'text-accent' : 'text-ink-soft')}
          >
            <Menu size={20} />
            <span>More</span>
            {waiting > 0 && !primary.some((p) => p.badge) && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-accent" />}
          </button>
        )}
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="More">
          <div className="flex flex-col gap-1">{rest.map((i) => link({ ...i }))}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
