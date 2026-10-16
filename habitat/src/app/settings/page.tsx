import { AccountSettings } from '@/components/AccountSettings';
import { SiteHeader } from '@/components/SiteHeader';
import { requireUser } from '@/lib/current-user';

export const metadata = { title: 'Account settings' };

export default async function SettingsPage() {
  const user = await requireUser({ next: '/settings' });
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">Account settings</h1>
        <AccountSettings name={user.name} email={user.email} prefs={user.emailPrefs} />
      </main>
    </>
  );
}
