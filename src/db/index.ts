import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const globalForDb = globalThis as unknown as {
  __brockSql?: ReturnType<typeof postgres>;
  __brockDb?: Db;
};

/**
 * Lazily creates one shared client. Lazy so `next build` and unit tests never need a database,
 * and cached on `globalThis` so dev hot reloads don't leak connections.
 */
export function getDb(): Db {
  if (!globalForDb.__brockDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__brockSql = postgres(url, {
      max: 10,
      prepare: false,
      // TRUNCATE ... CASCADE in the test harness is chatty.
      ...(process.env.NODE_ENV === 'test' && { onnotice: () => {} }),
    });
    globalForDb.__brockDb = drizzle(globalForDb.__brockSql, { schema });
  }
  return globalForDb.__brockDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__brockSql?.end({ timeout: 5 });
  globalForDb.__brockSql = undefined;
  globalForDb.__brockDb = undefined;
}

export { schema };
