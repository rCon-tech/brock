'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useNow } from '@/lib/use-now';
import { useHabitat } from '../sdk/context';
import { useCreateRecord, useRecords } from '../sdk/hooks';
import type { RecordDTO } from '../sdk/types';
import { tally } from './tally';

export interface PollData {
  question: string;
  options: string[];
  multiple?: boolean;
  closesAt?: string;
}

export function PollView({ poll }: { poll: RecordDTO & { data: PollData } }) {
  const { me } = useHabitat();
  const { question, options, multiple, closesAt } = poll.data;
  const votes = useRecords<{ choices: string[] }>({
    module: 'polls',
    collection: 'vote',
    parentId: poll.id,
    limit: 100,
    pollMs: 20_000,
  });
  const cast = useCreateRecord('polls', 'vote');
  const mine = votes.items.find((v) => v.author?.id === me.id);
  const nowMs = useNow(30_000);
  const closed = !!closesAt && nowMs > 0 && Date.parse(closesAt) <= nowMs;
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const showResults = (!!mine && !editing) || closed;
  const rows = tally(
    options,
    votes.items.map((v) => v.data),
    { multiple },
  );

  const selection = editing || !mine ? picked : (mine.data.choices ?? []);
  function toggle(o: string) {
    setPicked(
      multiple ? (picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o]) : [o],
    );
  }
  function submit() {
    cast.mutate(
      { parentId: poll.id, data: { choices: picked } },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">{question}</h3>
      <p className="flex items-center gap-1 text-xs text-ink-soft">
        {multiple ? 'Pick as many as you like' : 'Pick one'}
        {closesAt &&
          (closed ? (
            <>
              {' '}
              · <Lock size={12} /> closed
            </>
          ) : (
            <> · closes {new Date(closesAt).toLocaleString()}</>
          ))}
      </p>

      {showResults ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.option}>
              <div className="flex justify-between text-sm">
                <span className={cn(mine?.data.choices?.includes(r.option) && 'font-bold')}>
                  {r.option} {mine?.data.choices?.includes(r.option) && '✓'}
                </span>
                <span className="text-ink-soft">
                  {r.count} · {r.percent}%
                </span>
              </div>
              <div
                className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2"
                role="img"
                aria-label={`${r.option}: ${r.percent}%`}
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </li>
          ))}
          <li className="text-xs text-ink-soft">
            {votes.items.length} {votes.items.length === 1 ? 'vote' : 'votes'}
          </li>
        </ul>
      ) : (
        <fieldset className="space-y-2">
          <legend className="sr-only">{question}</legend>
          {options.map((o) => {
            const on = selection.includes(o);
            return (
              <label
                key={o}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3',
                  on ? 'border-accent bg-accent/10' : 'border-line hover:bg-surface-2',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={`poll-${poll.id}`}
                  checked={on}
                  onChange={() => toggle(o)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>{o}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {!closed && !showResults && (
        <Button onClick={submit} disabled={cast.isPending || !picked.length}>
          {mine ? 'Change my vote' : 'Vote'}
        </Button>
      )}
      {!closed && mine && showResults && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPicked(mine.data.choices ?? []);
            setEditing(true);
          }}
        >
          Change my vote
        </Button>
      )}
      {!closed && !mine && !showResults && votes.items.length > 0 && (
        <p className="text-xs text-ink-soft">Results show once you’ve voted.</p>
      )}
    </div>
  );
}
