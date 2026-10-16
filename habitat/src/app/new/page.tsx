import { CreateHabitatWizard } from '@/components/CreateHabitatWizard';
import { SiteHeader } from '@/components/SiteHeader';
import { requireUser } from '@/lib/current-user';
import { listLibrary } from '@/modules/registry';

export const metadata = { title: 'New Habitat' };

export default async function NewHabitat() {
  const user = await requireUser({ next: '/new' });
  const library = listLibrary();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-4 py-8">
        <CreateHabitatWizard
          starters={library.filter((m) => m.isDefault).map((m) => ({ id: m.id, name: m.name, tagline: m.tagline, icon: m.icon }))}
          later={library.filter((m) => !m.isDefault).map((m) => ({ name: m.name, tagline: m.tagline }))}
        />
      </main>
    </>
  );
}
