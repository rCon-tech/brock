import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach } from 'vitest';

// Point the app's database at the test instance before anything imports `@/db`.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://brock:brock@localhost:5433/brock_test';

import { closeDb, getDb, schema } from '@/db';

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: './drizzle' });
});

beforeEach(async () => {
  // Cascades through player -> brock -> brock_round and the auth tables.
  await getDb().execute(sql`TRUNCATE TABLE "user" CASCADE`);
});

afterAll(async () => {
  await closeDb();
});

let counter = 0;

/** Inserts a user + player and returns the user id. */
export async function createPlayer(
  handle: string,
  overrides: Partial<typeof schema.player.$inferInsert> = {},
): Promise<string> {
  const id = `user_${++counter}_${handle}`;
  const db = getDb();
  await db.insert(schema.user).values({ id, name: handle, email: `${id}@example.com` });
  await db.insert(schema.player).values({ userId: id, handle, ...overrides });
  return id;
}
