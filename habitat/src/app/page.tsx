import Link from 'next/link';
import { Lock, Puzzle, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HabitatCard } from '@/components/HabitatCard';
import { Logo } from '@/components/Logo';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/current-user';
import { listMyHabitats } from '@/lib/habitats';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  if (!user.onboardedAt) redirect('/onboarding');
  const habitats = await listMyHabitats(user.id);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">Your Habitats</h1>
        <p className="mt-1 text-ink-soft">Each one is a private home for a group of friends.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {habitats.map((h) => (
            <HabitatCard key={h.id} h={h} />
          ))}
          <Link
            href="/new"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-4 text-ink-soft transition hover:border-accent hover:text-ink"
          >
            <span className="text-3xl" aria-hidden>
              ＋
            </span>
            <span className="font-semibold">New Habitat</span>
          </Link>
        </div>
        {habitats.length === 0 && (
          <p className="mt-6 text-sm text-ink-soft">Got an invite link? Open it and you’ll land in your friends’ Habitat.</p>
        )}
      </main>
    </>
  );
}

function Landing() {
  const points = [
    { icon: Lock, title: 'Private by default', text: 'No public profiles, no search, no strangers. Only the people you invite can see anything.' },
    { icon: Puzzle, title: 'Build it from pieces', text: 'Start with a feed, photos, events and chat. Add polls, birthdays, shared costs and more from the library.' },
    { icon: Vote, title: 'Decided together', text: 'Anyone can suggest a new piece. The group votes, and it appears for everyone.' },
  ];
  return (
    <main>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-12 text-center">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Your friends. Your rules.
          <br />
          <span className="text-accent">Your Habitat.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">
          A small, private social network that belongs to your group. You choose what’s in it, together.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Start your Habitat</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-line bg-surface p-5">
            <Icon className="text-accent" size={26} />
            <h2 className="mt-3 text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-line py-6 text-center text-sm text-ink-soft">No ads. No algorithm. No selling your friends’ photos.</footer>
    </main>
  );
}
