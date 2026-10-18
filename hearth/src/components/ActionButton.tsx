'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/action';

interface Props {
  /** A server action already bound to its arguments. */
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  /** Where to go on success; otherwise the page just refreshes. */
  redirectTo?: string;
  disabled?: boolean;
  title?: string;
}

/** A button that runs a server action, shows any friendly error, then refreshes the page. */
export function ActionButton({
  action,
  children,
  className = 'btn btn-secondary',
  confirm,
  redirectTo,
  disabled,
  title,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={className}
        disabled={pending || disabled}
        title={title}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const result = await action();
            if (!result.ok) return setError(result.error);
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}
      >
        {pending ? 'One moment…' : children}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-clay-dark">
          {error}
        </span>
      ) : null}
    </span>
  );
}
