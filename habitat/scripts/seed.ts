/**
 * `pnpm db:seed`: a demo Habitat with 5 members, posts, an event and an open vote.
 * Sign in as any seeded person by running with EMAIL_TRANSPORT=console and requesting a link for
 * their address (demo1@example.com … demo5@example.com).
 */
import 'dotenv/config';

async function main() {
  const { getDb } = await import('../src/db');
  const s = await import('../src/db/schema');
  const { createHabitat } = await import('../src/lib/habitats');
  const { createRecord } = await import('../src/lib/records');
  const { addComment, addReaction } = await import('../src/lib/interactions');
  const { propose } = await import('../src/lib/proposals');
  const { eq } = await import('drizzle-orm');

  const db = getDb();
  const names = ['Alex', 'Bea', 'Cal', 'Dev', 'Eve'];
  const people = [] as Array<{ id: string; name: string }>;
  for (const [i, name] of names.entries()) {
    const email = `demo${i + 1}@example.com`;
    const [existing] = await db.select().from(s.user).where(eq(s.user.email, email));
    if (existing) {
      people.push({ id: existing.id, name });
      continue;
    }
    const id = crypto.randomUUID();
    await db
      .insert(s.user)
      .values({ id, name, email, emailVerified: true, onboardedAt: new Date() });
    people.push({ id, name });
  }

  const h = await createHabitat(people[0]!.id, {
    name: 'The Demo Crew',
    emoji: '🏕️',
    accent: '#1c7ed6',
  });
  const ctx = (i: number, role: 'owner' | 'member') => ({
    userId: people[i]!.id,
    habitatId: h.id,
    role,
    nickname: null,
  });
  for (const p of people.slice(1))
    await db.insert(s.membership).values({ habitatId: h.id, userId: p.id, role: 'member' });

  const post = await createRecord(ctx(0, 'owner'), {
    module: 'feed',
    collection: 'post',
    data: { text: 'Welcome to the Demo Crew! Say hi 👋' },
  });
  await addReaction(ctx(1, 'member'), post.id, '❤️');
  await addComment(ctx(2, 'member'), post.id, { body: 'Hello from Cal!' });
  await createRecord(ctx(1, 'member'), {
    module: 'feed',
    collection: 'post',
    data: { text: 'Who’s up for a weekend away?' },
  });
  await createRecord(ctx(3, 'member'), {
    module: 'events',
    collection: 'event',
    data: {
      title: 'Pub quiz',
      startsAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
      location: 'The Red Lion',
    },
  });
  await propose(ctx(4, 'member'), {
    kind: 'install',
    moduleId: 'polls',
    reason: 'So we can settle where to go',
  });

  console.log(
    `Seeded http://localhost:3000/h/${h.slug}\nSign in as demo1@example.com … demo5@example.com`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
