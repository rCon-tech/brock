import { redirect } from 'next/navigation';
import { HandleForm } from '@/components/HandleForm';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose your handle' };

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (viewer.state === 'signed_out') redirect('/');
  if (viewer.state === 'player') redirect('/');

  return (
    <section className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
      <div>
        <h1 className="text-3xl font-extrabold">Pick a handle</h1>
        <p className="mt-2 text-brock-muted">One more step before your first Brock.</p>
      </div>
      <HandleForm />
    </section>
  );
}
