import { HomeFeed } from '@/components/HomeFeed';
import { getDb } from '@/db';
import { requireUser } from '@/lib/current-user';
import { listActive } from '@/lib/installed-modules';
import { requireMemberBySlug } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

export default async function HabitatHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}` });
  const { ctx } = await requireMemberBySlug(getDb(), slug, user.id);
  const installed = (await listActive(getDb(), ctx.habitatId)).map((a) => a.manifest.id);
  return <HomeFeed installed={installed} />;
}
