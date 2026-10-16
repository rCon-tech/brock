'use client';

import { useSyncExternalStore } from 'react';

/**
 * The current time, rounded down to `stepMs` and refreshed on that interval. It is `0` while
 * rendering on the server and during hydration, so server and client markup always match;
 * anything that depends on the real time should treat `0` as "not known yet".
 */
export function useNow(stepMs = 60_000): number {
  return useSyncExternalStore(
    (notify) => {
      const t = setInterval(notify, stepMs);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / stepMs) * stepMs,
    () => 0,
  );
}
