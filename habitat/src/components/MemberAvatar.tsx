'use client';

import * as A from '@radix-ui/react-avatar';
import type { MemberDTO } from '@/modules/sdk/types';
import { cn, initials } from '@/lib/utils';

const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };

export function displayName(m: Pick<MemberDTO, 'name' | 'nickname'> | null | undefined) {
  return m ? m.nickname || m.name : 'Former member';
}

export function MemberAvatar({
  member,
  size = 'md',
  className,
}: {
  member: Pick<MemberDTO, 'name' | 'image' | 'nickname'> | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const name = displayName(member);
  return (
    <A.Root className={cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-accent/20 font-bold text-ink', sizes[size], className)}>
      {member?.image ? <A.Image src={member.image} alt="" className="h-full w-full object-cover" /> : null}
      <A.Fallback aria-hidden>{member ? initials(name) : '?'}</A.Fallback>
    </A.Root>
  );
}
