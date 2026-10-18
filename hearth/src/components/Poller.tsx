'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Refreshes the page when something other people did changes what it shows (progress, the
 * reveal, the board's wording). Plain polling: no sockets needed (R18).
 */
export function Poller({
  projectId,
  signature,
  intervalMs = 3000,
}: {
  projectId: string;
  signature: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const last = useRef(signature);

  useEffect(() => {
    last.current = signature;
  }, [signature]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden || stopped) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/state`, { cache: 'no-store' });
        if (!res.ok) return;
        const state = (await res.json()) as { signature: string };
        if (state.signature !== last.current) {
          last.current = state.signature;
          router.refresh();
        }
      } catch {
        // Offline: try again on the next tick.
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [projectId, intervalMs, router]);

  return null;
}
