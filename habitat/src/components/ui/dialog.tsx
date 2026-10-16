'use client';

import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** A centred dialog on desktop and a bottom sheet on phones. */
export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        className={cn(
          'safe-bottom fixed z-50 w-full max-w-lg border border-line bg-surface p-5 shadow-xl',
          'bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
          'max-h-[90dvh] overflow-y-auto',
          className,
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <D.Title className="text-lg font-bold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-ink-soft">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close aria-label="Close" className="rounded-lg p-1 text-ink-soft hover:bg-surface-2">
            <X size={20} />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
