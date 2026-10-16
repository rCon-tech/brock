import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __habitatSql?: postgres.Sql };

function client(): postgres.Sql {
  if (!globalForDb.__habitatSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__habitatSql = postgres(url, { max: 10, prepare: false });
  }
  return globalForDb.__habitatSql;
}

let _db: ReturnType<typeof create> | undefined;
function create() {
  return drizzle(client(), { schema });
}

/** Lazy so that importing this module never needs a database (build, unit tests). */
export function getDb() {
  return (_db ??= create());
}

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything you can run queries on: the db itself or a transaction. */
export type Executor = Db | Tx;

export { schema };
