import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';

// Next injects small inline scripts, so 'unsafe-inline' is needed without per-request nonces; the real
// protection is that Habitat never renders user HTML (see the react/no-danger lint rule).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos redirect to short-lived signed URLs on Cloudflare R2; avatars may come from Google.
  "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://lh3.googleusercontent.com",
  // Direct-to-storage uploads (presigned PUT) and Ably realtime.
  `connect-src 'self' https://*.r2.cloudflarestorage.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com${dev ? ' ws://localhost:*' : ''}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  // Don't let `next dev` write an AGENTS.md into the repo.
  agentRules: false,
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      {
        source: '/h/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
