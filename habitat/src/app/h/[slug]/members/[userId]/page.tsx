import { notFound } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { NicknameForm } from '@/components/NicknameForm';
import { RelativeTime } from '@/components/RelativeTime';
import { EmptyState } from '@/components/EmptyState';
import { getDb } from '@/db';
import { record } from '@/db/schema';
import { requireUser } from '@/lib/current-user';
import { listActive } from '@/lib/installed-modules';
import { listMembers } from '@/lib/members';
import { requireMemberBySlug } from '@/lib/session';
import { Badge, Card } from '@/components/ui/card';

export const metadata = { title: 'Member' };

export default async function MemberPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  const user = await requireUser({ next: `/h/${slug}/members/${userId}` });
  const { ctx, habitat } = await requireMemberBySlug(getDb(), slug, user.id);
  const person = (await listMembers(habitat.id)).find((m) => m.userId === userId);
  if (!person) notFound();

  const feedOn = (await listActive(getDb(), ctx.habitatId)).some((a) => a.manifest.id === 'feed');
  const posts = !feedOn
    ? []
    : await getDb()
        .select()
        .from(record)
        .where(
          and(
            eq(record.habitatId, ctx.habitatId),
            eq(record.authorId, userId),
            eq(record.moduleId, 'feed'),
            eq(record.collection, 'post'),
            isNull(record.deletedAt),
          ),
        )
        .orderBy(desc(record.createdAt))
        .limit(20);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <MemberAvatar
          member={{ name: person.name, image: person.image, nickname: person.nickname }}
          size="lg"
        />
        <div>
          <h1 className="text-2xl font-extrabold">{displayName(person)}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            {person.nickname && <span>{person.name}</span>}
            <Badge tone={person.role === 'member' ? 'neutral' : 'accent'}>{person.role}</Badge>
            <span>
              Joined <RelativeTime iso={person.joinedAt} />
            </span>
          </div>
        </div>
      </div>
      {userId === user.id && <NicknameForm initial={person.nickname ?? ''} />}
      <section>
        <h2 className="mb-2 font-bold">Recent posts</h2>
        {posts.length === 0 ? (
          <EmptyState emoji="📝" title="No posts yet" />
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id}>
                <Card>
                  <p className="whitespace-pre-wrap break-words">{String(p.data.text ?? '')}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    <RelativeTime iso={p.createdAt.toISOString()} />
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
