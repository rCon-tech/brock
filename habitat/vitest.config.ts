import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    // Integration tests share one database, so test files run one at a time.
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
          setupFiles: ['tests/integration/setup.ts'],
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/{governance,permissions,invite-code,slug,mentions,record-query}.ts',
        'src/modules/sdk/{fields,manifest-schema}.ts',
      ],
    },
  },
});
