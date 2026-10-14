import { defineConfig } from 'drizzle-kit';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env');
} catch {
  // .env is optional; DATABASE_URL may come from the real environment.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://brock:brock@localhost:5432/brock' },
});
