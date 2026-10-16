'use client';

import { useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { Textarea } from '@/components/ui/input';
import { useHabitat } from '@/modules/sdk/context';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (v: string) => void;
}

/** A textarea that suggests members as you type "@". */
export function MentionInput({ value, onValueChange, ...props }: Props) {
  const { members, me } = useHabitat();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return members.filter((m) => m.id !== me.id && displayName(m).toLowerCase().startsWith(q)).slice(0, 5);
  }, [query, members, me.id]);

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}\p{N}_ ]{0,30})$/u.exec(before);
    setQuery(m ? { start: caret - m[1]!.length - 1, text: m[1]! } : null);
  }

  function pick(name: string) {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}@${name} ${value.slice(caret)}`;
    onValueChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        {...props}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery(null);
          props.onKeyDown?.(e);
        }}
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Mention a member" className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.map((m) => (
            <li key={m.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(displayName(m))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                <MemberAvatar member={m} size="xs" /> {displayName(m)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
