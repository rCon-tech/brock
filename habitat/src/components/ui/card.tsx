import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]', className)} {...props} />;
}

export function Badge({ className, tone = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'ok' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-soft',
    accent: 'bg-accent/15 text-ink',
    ok: 'bg-ok/15 text-ok',
    danger: 'bg-danger/15 text-danger',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone], className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}
