import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import path from 'node:path';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

const globalForDb = globalThis as unknown as { __hearthDb?: Promise<Db> };

/**
 * One database handle per process.
 *
 * - `DATABASE_URL=postgres://…` uses real Postgres (Neon etc.); run `pnpm db:migrate` on deploy.
 * - `DATABASE_URL=pglite://memory` uses an in-memory PGlite database (tests).
 * - Unset (development) uses a file-backed PGlite database in `.data/pglite`.
 *
 * PGlite is Postgres compiled to WASM with the pgvector extension, so local development and
 * tests need no Docker. It migrates itself on start.
 */
export function getDb(): Promise<Db> {
  globalForDb.__hearthDb ??= createDb();
  return globalForDb.__hearthDb;
}

async function createDb(): Promise<Db> {
  const url = env.DATABASE_URL;
  if (url && /^postgres(ql)?:/.test(url)) {
    return drizzlePostgres(postgres(url, { max: 5 }), { schema }) as unknown as Db;
  }
  const dataDir =
    url === 'pglite://memory'
      ? undefined
      : (url?.replace(/^pglite:\/\//, '') ?? path.join(process.cwd(), '.data', 'pglite'));
  const client = new PGlite({ dataDir, extensions: { vector } });
  await client.waitReady;
  await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

/** Test helper: drop the cached handle so the next getDb() builds a fresh database. */
export function resetDbForTests(): void {
  globalForDb.__hearthDb = undefined;
}
