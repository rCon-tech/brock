import Link from 'next/link';
import { Check } from 'lucide-react';
import { ModuleIcon } from '@/components/ModuleIcon';
import { Badge, Card } from '@/components/ui/card';

export interface ModuleCardData {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  installed: boolean;
  voteOpen: { yes: number; memberCount: number } | null;
}

export function ModuleCard({ m, slug }: { m: ModuleCardData; slug: string }) {
  return (
    <Link href={`/h/${slug}/library/${m.id}`} className="block rounded-2xl focus-visible:outline-offset-4">
      <Card className="flex h-full items-start gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <ModuleIcon name={m.icon} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="font-bold">{m.name}</span>
            {m.installed ? (
              <Badge tone="ok">
                <Check size={12} className="mr-0.5" /> Installed
              </Badge>
            ) : m.voteOpen ? (
              <Badge tone="accent">
                Vote open: {m.voteOpen.yes}/{m.voteOpen.memberCount} yes
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">{m.tagline}</span>
        </span>
      </Card>
    </Link>
  );
}
