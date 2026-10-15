'use client';

import { useEffect, useState } from 'react';

interface Props {
  /** Milliseconds until the next 00:00 UTC, as measured by the server. */
  msUntilReset: number;
  /** Called once when the countdown reaches zero so the page can load the new day. */
  onZero?: () => void;
}

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function Countdown({ msUntilReset, onZero }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Anchor to the server's clock reading so a wrong device clock can't shift the reset.
    const target = Date.now() + msUntilReset;
    let fired = false;
    const tick = () => {
      const left = target - Date.now();
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        onZero?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [msUntilReset, onZero]);

  return (
    <p className="caps text-xs">
      Next Brock in{' '}
      <time className="font-display text-xl tracking-wider tabular-nums">
        {remaining === null ? '--:--:--' : format(remaining)}
      </time>
    </p>
  );
}
