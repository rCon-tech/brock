import { afterAll, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url =
  process.env.TEST_DATABASE_URL ?? 'postgres://habitat:habitat@localhost:5433/habitat_test';
// Must be set before anything imports `@/db`.
process.env.DATABASE_URL = url;
process.env.EMAIL_TRANSPORT = 'outbox';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

beforeAll(async () => {
  const { getDb } = await import('@/db');
  await migrate(getDb(), { migrationsFolder: './drizzle' });
});

beforeEach(async () => {
  const { getDb } = await import('@/db');
  const rows = await getDb().execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(', ');
  await getDb().execute(sql.raw(`truncate ${names} restart identity cascade`));
});

afterAll(async () => {
  // The client is a shared singleton; vitest tears the worker down after each file.
});
