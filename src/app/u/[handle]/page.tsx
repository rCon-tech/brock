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
  won: { symbol: '✅', label: 'won', className: '' },
  lost: { symbol: '❌', label: 'lost', className: '' },
  pending: { symbol: '⏳', label: 'in progress', className: '' },
  none: { symbol: '·', label: 'no Brock', className: 'text-brock-muted' },
};

function DayCell({ day }: { day: ProfileDay }) {
  const mark = MARK[day.status ?? 'none'];
  return (
    <li
      className={`flex aspect-square items-center justify-center rounded-lg border border-brock-line bg-brock-card text-lg ${mark.className}`}
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
    <div className="rounded-xl border border-brock-line bg-brock-card p-4">
      <dt className="text-xs uppercase tracking-wide text-brock-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
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
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold">@{player.handle ?? handle}</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Streak" value={`🔥 ${current}`} />
        <Stat label="Best" value={player.bestStreak} />
        <Stat label="Wins" value={player.totalWins} />
        <Stat label="Losses" value={player.totalLosses} />
      </dl>

      <div>
        <h2 className="mb-2 text-lg font-extrabold">Last 30 days</h2>
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
