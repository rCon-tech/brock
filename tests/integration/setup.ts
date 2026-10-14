import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach } from 'vitest';

// Point the app's database at the test instance before anything imports `@/db`.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://brock:brock@localhost:5433/brock_test';

import { closeDb, getDb, schema } from '@/db';
import { hashToken } from '@/lib/identity';

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: './drizzle' });
});

beforeEach(async () => {
  // Cascades through player -> brock -> brock_round.
  await getDb().execute(sql`TRUNCATE TABLE player CASCADE`);
});

afterAll(async () => {
  await closeDb();
});

let counter = 0;

/** Inserts a player (unnamed when `handle` is null) and returns its id. */
export async function createPlayer(
  handle: string | null,
  overrides: Partial<typeof schema.player.$inferInsert> = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(schema.player)
    .values({ handle, ...overrides })
    .returning({ id: schema.player.id });
  await getDb()
    .insert(schema.playerSession)
    .values({ tokenHash: hashToken(`test-token-${++counter}-${handle}`), playerId: row.id });
  return row.id;
}

/** Bulk-inserts `count` named players sharing the same overrides. */
export async function createPlayers(
  count: number,
  overrides: Partial<typeof schema.player.$inferInsert> = {},
): Promise<void> {
  await getDb()
    .insert(schema.player)
    .values(
      Array.from({ length: count }, (_, i) => ({
        handle: `player_${String(i).padStart(3, '0')}`,
        ...overrides,
      })),
    );
}
