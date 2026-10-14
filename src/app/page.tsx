import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrockGame } from '@/components/BrockGame';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { SignInButtons } from '@/components/SignInButtons';
import { configuredProviders } from '@/lib/auth';
import { topPlayers } from '@/lib/leaderboard';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const viewer = await getViewer();

  if (viewer.state === 'needs_handle') redirect('/onboarding');
  if (viewer.state === 'player') return <BrockGame />;

  const top = await topPlayers(5);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 pt-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          One Brock a day.
          <br />
          <span className="text-brock-accent">How long can you last?</span>
        </h1>
        <p className="text-lg text-brock-muted">
          Brock is rock paper scissors against the House, once a day. Win and your streak grows.
          Lose, or miss a day, and it’s back to zero. The House’s throw is locked in before you
          pick, and you can verify it never cheats.
        </p>
        <SignInButtons providers={configuredProviders()} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="top-title">
        <div className="flex items-baseline justify-between">
          <h2 id="top-title" className="text-xl font-extrabold">
            Longest streaks
          </h2>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-brock-accent hover:underline"
          >
            Full leaderboard →
          </Link>
        </div>
        <LeaderboardTable entries={top} />
      </section>
    </div>
  );
}
