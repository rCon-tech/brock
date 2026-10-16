import type { ReactNode } from 'react';

export function EmptyState({ emoji = '🌱', title, children }: { emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div aria-hidden className="text-4xl">
        {emoji}
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      {children ? <div className="max-w-sm text-sm text-ink-soft">{children}</div> : null}
    </div>
  );
}
