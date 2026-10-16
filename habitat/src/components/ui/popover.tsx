'use client';

import * as P from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({ className, ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={8}
        align="end"
        className={cn('z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-2 shadow-xl', className)}
        {...props}
      />
    </P.Portal>
  );
}
