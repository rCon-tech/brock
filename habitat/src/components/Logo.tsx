import Link from 'next/link';

export function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'md' | 'lg' }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>
      <span aria-hidden>🌿</span>
      <span>Habitat</span>
    </Link>
  );
}
