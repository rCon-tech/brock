import { InviteDialog } from '@/components/InviteDialog';
import { MemberList } from '@/components/MemberList';
import { getDb } from '@/db';
import { habitat } from '@/db/schema';
import { requireUser } from '@/lib/current-user';
import { requireMemberBySlug } from '@/lib/session';
import { eq } from 'drizzle-orm';

export const metadata = { title: 'Members' };

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser({ next: `/h/${slug}/members` });
  const { ctx, habitat: h } = await requireMemberBySlug(getDb(), slug, user.id);
  const [{ cap }] = await getDb().select({ cap: habitat.memberCap }).from(habitat).where(eq(habitat.id, h.id));
  const canInvite = h.membersCanInvite || ctx.role !== 'member';
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Members</h1>
          <p className="text-sm text-ink-soft">Up to {cap} people. Nobody outside this list can see anything.</p>
        </div>
        <InviteDialog canInvite={canInvite} />
      </div>
      <MemberList />
    </div>
  );
}
