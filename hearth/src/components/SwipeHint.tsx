'use client';

import { useState, useSyncExternalStore } from 'react';

const KEY = 'hearth-hint-seen';

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
}

function seenBefore(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** First card ever: a short demo of how swiping works (R35). Shown once per browser. */
export function SwipeHint({ show }: { show: boolean }) {
  // The server renders "seen" so nothing flashes; the browser then reads the real value.
  const seen = useSyncExternalStore(subscribe, seenBefore, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (!show || seen || dismissed) return null;
  return (
    <div
      role="dialog"
      aria-label="How to swipe"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-3xl bg-ink/80 p-6 text-center text-paper"
    >
      <div aria-hidden className="relative h-16 w-full max-w-[14rem]">
        <div className="hint-card absolute top-1/2 left-1/2 h-14 w-10 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-paper" />
      </div>
      <p className="font-display text-xl font-bold">Swipe right for yes, left for no</p>
      <p className="text-sm text-paper/80">
        Tap a card for details. Use a veto for anything you really can’t live with. You get three.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            // Private mode: the hint just shows again next time.
          }
          setDismissed(true);
        }}
      >
        Got it
      </button>
      <style>{`
        @keyframes hint-slide { 0%, 100% { transform: translate(-50%, -50%) } 25% { transform: translate(60px, -50%) rotate(8deg) } 75% { transform: translate(-160px, -50%) rotate(-8deg) } }
        .hint-card { animation: hint-slide 2.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .hint-card { animation: none } }
      `}</style>
    </div>
  );
}
