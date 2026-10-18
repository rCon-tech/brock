import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Applies ./drizzle to a real Postgres (PGlite migrates itself on start).
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:/.test(url)) {
    console.log('DATABASE_URL is not a Postgres URL; PGlite migrates itself. Nothing to do.');
    return;
  }
  const client = postgres(url, { max: 1 });
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
  console.log('Migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
