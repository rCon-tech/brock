'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ActionResult } from '@/lib/action';
import type { ProjectState } from '@/lib/project-state';

const COUNTDOWN_MS = 3000;
const FORCE_AFTER_MS = 30_000;

/**
 * Waits until everyone is ready, then reveals together: the same short countdown on every phone
 * (R18). Polls every two seconds; no sockets.
 */
export function RevealGate({
  projectId,
  initial,
  boardHref,
  forceReveal,
}: {
  projectId: string;
  initial: ProjectState;
  boardHref: string;
  forceReveal: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const [mountedAt] = useState(() => Date.now());
  const [forcing, setForcing] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/state`, { cache: 'no-store' });
        if (!res.ok || stop) return;
        const next = (await res.json()) as ProjectState;
        setState(next);
        if (next.revealed) setRevealedAt((t) => t ?? Date.now());
      } catch {
        // Offline for a moment; the next tick tries again.
      }
    };
    const pollId = setInterval(poll, 2000);
    const tickId = setInterval(() => setNow(Date.now()), 200);
    void poll();
    return () => {
      stop = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [projectId]);

  const remaining = revealedAt === null ? null : Math.max(0, COUNTDOWN_MS - (now - revealedAt));
  useEffect(() => {
    if (remaining === 0 && !pushed.current) {
      pushed.current = true;
      router.push(boardHref);
    }
  }, [remaining, boardHref, router]);

  const finished = state.people.filter((p) => p.finished).length;
  const waitingOn = state.people.filter((p) => !p.ready);
  const canForce = !state.revealed && finished >= 2 && now - mountedAt >= FORCE_AFTER_MS;

  if (remaining !== null) {
    const n = Math.ceil(remaining / 1000);
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center"
      >
        <p className="eyebrow">Here it comes</p>
        <p className="font-display text-8xl font-bold text-clay" aria-label={`${n}`}>
          {n || '✨'}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[50dvh] flex-col items-center justify-center gap-5 text-center"
      role="status"
      aria-live="polite"
    >
      <h1 className="text-3xl font-bold">
        {waitingOn.length === 0
          ? 'Getting your board ready…'
          : `Waiting for ${waitingOn.map((p) => p.name).join(' and ')}`}
      </h1>
      <ul className="flex flex-wrap justify-center gap-2">
        {state.people.map((p) => (
          <li key={p.id} className={`chip ${p.ready ? 'chip-sage' : ''}`}>
            {p.name}: {p.ready ? 'ready' : p.finished ? 'finished' : 'still swiping'}
          </li>
        ))}
      </ul>
      <p className="max-w-sm text-sm text-muted">
        The board appears for everyone at the same moment, as soon as the last person taps ready.
      </p>
      {canForce ? (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={forcing}
          onClick={async () => {
            setForcing(true);
            await forceReveal();
            setForcing(false);
          }}
        >
          Show the board now
        </button>
      ) : null}
    </div>
  );
}
