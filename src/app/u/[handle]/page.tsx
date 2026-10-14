import { notFound } from 'next/navigation';
import { utcDay } from '@/lib/day';
import { effectiveStreak } from '@/lib/streak';
import { getProfile, type ProfileDay } from '@/lib/players';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  return { title: `@${handle}` };
}

const MARK: Record<string, { symbol: string; label: string; className: string }> = {
  won: { symbol: 'W', label: 'won', className: 'bg-olive text-paper' },
  lost: { symbol: 'L', label: 'lost', className: 'bg-rust text-paper' },
  pending: { symbol: '…', label: 'in progress', className: 'bg-gold' },
  none: { symbol: '·', label: 'no Brock', className: 'bg-paper/60' },
};

function DayCell({ day }: { day: ProfileDay }) {
  const mark = MARK[day.status ?? 'none'];
  return (
    <li
      className={`flex aspect-square items-center justify-center border-2 border-ink font-display text-lg ${mark.className}`}
      title={`${day.day}: ${mark.label}`}
    >
      <span aria-hidden>{mark.symbol}</span>
      <span className="sr-only">
        {day.day}: {mark.label}
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel px-4 pt-3 pb-2">
      <dt className="caps text-[11px]">{label}</dt>
      <dd className="font-display text-3xl tabular-nums">{value}</dd>
    </div>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const today = utcDay(new Date());
  const profile = await getProfile(handle, today);
  if (!profile) notFound();

  const { player, days } = profile;
  const current = effectiveStreak(player, today);

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="comic-heading -rotate-2 text-center text-6xl break-all">
        @{player.handle ?? handle}
      </h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Streak" value={current} />
        <Stat label="Best" value={player.bestStreak} />
        <Stat label="Wins" value={player.totalWins} />
        <Stat label="Losses" value={player.totalLosses} />
      </dl>

      <div>
        <h2 className="comic-heading mb-3 text-3xl">LAST 30 DAYS</h2>
        <ol
          className="grid grid-cols-10 gap-1.5 text-center"
          aria-label="Last 30 days, oldest first"
        >
          {days.map((d) => (
            <DayCell key={d.day} day={d} />
          ))}
        </ol>
      </div>
    </section>
  );
}
