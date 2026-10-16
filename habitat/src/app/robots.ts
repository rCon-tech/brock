import type { MetadataRoute } from 'next';

/** Habitats are private. Only the landing page may be indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/$', disallow: ['/h/', '/api/', '/join/', '/settings', '/new', '/onboarding', '/login'] } };
}
