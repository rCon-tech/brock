'use client';

import { useState } from 'react';
import type { TodayState } from '@/lib/brock-service';
import { buildShareText } from '@/lib/share';

interface Props {
  state: TodayState;
}

export function ShareButton({ state }: Props) {
  const [note, setNote] = useState('');

  async function share() {
    const text = buildShareText({
      brockNumber: state.brockNumber,
      results: state.rounds.map((r) => r.result),
      score: state.score,
      url: process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
    });

    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setNote('Copied!');
    } catch (err) {
      // Dismissing the native share sheet rejects with AbortError; that's not a failure.
      if ((err as DOMException)?.name === 'AbortError') return;
      setNote('Couldn’t copy. Select and copy manually.');
    }
    setTimeout(() => setNote(''), 2500);
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={share} className="btn-paper">
        Share result
      </button>
      <span role="status" className="font-slab text-sm">
        {note}
      </span>
    </div>
  );
}
