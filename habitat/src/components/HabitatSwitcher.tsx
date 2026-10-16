'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { inkFor } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Mine {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  accent: string;
}

export function HabitatSwitcher({
  current,
}: {
  current: { slug: string; name: string; emoji: string; accent: string };
}) {
  const { data } = useQuery({
    queryKey: ['my-habitats'],
    queryFn: () => apiFetch<{ habitats: Mine[] }>('/api/habitats'),
    staleTime: 60_000,
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex max-w-[60vw] items-center gap-2 rounded-xl px-2 py-1 hover:bg-surface-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg"
          style={{ background: current.accent, color: inkFor(current.accent) }}
          aria-hidden
        >
          {current.emoji}
        </span>
        <span className="truncate font-bold">{current.name}</span>
        <ChevronsUpDown size={16} className="shrink-0 text-ink-soft" aria-hidden />
        <span className="sr-only">Switch Habitat</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(data?.habitats ?? []).map((h) => (
          <DropdownMenuItem key={h.id} asChild>
            <Link href={`/h/${h.slug}`}>
              <span aria-hidden>{h.emoji}</span> {h.name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/new">
            <Plus size={16} /> New Habitat
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">All my Habitats</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
