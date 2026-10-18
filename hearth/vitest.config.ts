import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // Each test file gets its own in-memory PGlite database, seeded by the test itself.
          env: { DATABASE_URL: 'pglite://memory', SEED_ON_EMPTY: '0', SOLO_AFTER_MS: '1000' },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
