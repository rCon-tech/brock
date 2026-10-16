import { notFound } from 'next/navigation';
import { utcDay } from '@/lib/day';
import { getProfile, type ProfileDay } from '@/lib/players';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  return { title: `@${handle}` };
}

function mark(day: ProfileDay): { symbol: string; label: string; className: string } {
  if (day.score === null) return { symbol: '·', label: 'no run', className: 'bg-paper/60' };
  const label = `run of ${day.score}${day.playing ? ', still going' : ''}`;
  if (day.playing) return { symbol: String(day.score), label, className: 'bg-gold' };
  if (day.score === 0) return { symbol: '0', label, className: 'bg-rust text-paper' };
  return { symbol: String(day.score), label, className: 'bg-olive text-paper' };
}

function DayCell({ day }: { day: ProfileDay }) {
  const { symbol, label, className } = mark(day);
  return (
    <li
      className={`flex aspect-square items-center justify-center border-2 border-ink font-display text-lg ${className}`}
      title={`${day.day}: ${label}`}
    >
      <span aria-hidden>{symbol}</span>
      <span className="sr-only">
        {day.day}: {label}
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
  const todayRun = days.at(-1)?.score ?? null;

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="comic-heading -rotate-2 text-center text-6xl break-all">
        @{player.handle ?? handle}
      </h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Today" value={todayRun ?? '–'} />
        <Stat label="Best run" value={player.bestScore} />
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
