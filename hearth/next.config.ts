import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite loads WASM and extension bundles from disk, so it must not be bundled.
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
};

export default nextConfig;
