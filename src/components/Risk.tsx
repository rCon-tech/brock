'use client';

import { useState } from 'react';
import type { TodayState } from '@/lib/brock-service';

/** Offered once the quiz's extra life is spent: one all-or-nothing Brock. */
export function RiskOffer({
  score,
  onUpdate,
  onStale,
}: {
  score: number;
  onUpdate: (state: TodayState) => void;
  onStale: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function take() {
    setPending(true);
    try {
      const res = await fetch('/api/brock/risk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return onStale();
      onUpdate(await res.json());
    } catch {
      onStale();
    }
  }

  return (
    <div className="panel flex w-full max-w-md -rotate-1 flex-col items-center gap-3 px-4 pt-4 pb-5 text-center">
      <div className="stamp" data-outcome="loss">
        RISK IT ALL?
      </div>
      <p className="text-[15px] leading-relaxed">
        One last Brock, all or nothing. <strong>Win</strong> and your run carries on from{' '}
        <strong>{score}</strong> (this one doesn’t score). <strong>Lose</strong> and today’s run
        drops to <strong>0</strong>.
      </p>
      <button type="button" className="btn-ink" onClick={take} disabled={pending}>
        {pending ? 'NO GOING BACK…' : 'RISK IT'}
      </button>
      <p className="caps text-[11px]">Or keep your {score} and come back tomorrow.</p>
    </div>
  );
}

/** Shown above the picker while the risked Brock is being played. */
export function RiskBanner({ score }: { score: number }) {
  return (
    <div
      className="panel flex w-full max-w-md flex-col items-center gap-1 px-4 pt-3 pb-3 text-center"
      data-testid="risk-banner"
    >
      <p className="font-display text-2xl leading-tight tracking-wide text-rust">ALL OR NOTHING</p>
      <p className="text-[15px]">
        Win to keep your run of <strong>{score}</strong> going. Lose and today scores 0.
      </p>
    </div>
  );
}
