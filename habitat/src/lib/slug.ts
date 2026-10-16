export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

export function slugify(name: string): string {
  let s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
  if (s.length < SLUG_MIN) s = (s + '-habitat').replace(/^-/, '').slice(0, SLUG_MAX);
  return s;
}

/** `the-lads` taken → `the-lads-2`, `the-lads-3`, ... (n >= 2). */
export function withSuffix(slug: string, n: number): string {
  if (n < 2) return slug;
  const suffix = `-${n}`;
  return slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, '') + suffix;
}

const RESERVED = new Set(['new', 'api', 'login', 'join', 'settings', 'onboarding', 'admin']);
export function isReserved(slug: string): boolean {
  return RESERVED.has(slug);
}
