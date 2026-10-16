'use client';

import { useEffect, useState } from 'react';
import type { RevealedRound } from '@/lib/brock-service';

interface Props {
  round: RevealedRound;
  /** The run's score after this round. */
  score: number;
}

const STAMP = { win: 'YOU WIN!', loss: 'THE HOUSE WINS', draw: 'TIE!' } as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function verdict(round: RevealedRound, score: number): string {
  if (round.result === 'win')
    return `${cap(round.player)} beats ${round.house}. ${score === 1 ? 'First win' : `That’s ${score} in a row`}. Keep going!`;
  if (round.result === 'loss')
    return `${cap(round.house)} beats ${round.player}. Your run ends at ${score}.`;
  return `You both threw ${round.player}. A tie doesn’t count, so Brock again.`;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Recomputes the commitment in the browser so players don't have to trust the server's word. */
function FairnessPanel({ round }: { round: RevealedRound }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    sha256Hex(`${round.house}:${round.salt}`)
      .then((hash) => !cancelled && setVerified(hash === round.commitHash))
      .catch(() => !cancelled && setVerified(null));
    return () => {
      cancelled = true;
    };
  }, [round]);

  return (
    <dl className="panel w-full space-y-1 p-3 text-left font-mono text-xs">
      <div>
        <dt className="inline font-bold">Committed hash: </dt>
        <dd className="inline break-all">{round.commitHash}</dd>
      </div>
      <div>
        <dt className="inline font-bold">House threw: </dt>
        <dd className="inline">{round.house}</dd>
      </div>
      <div>
        <dt className="inline font-bold">Salt: </dt>
        <dd className="inline break-all">{round.salt}</dd>
      </div>
      <p className="pt-1 font-slab text-sm" role="status">
        {verified === true && '✅ sha256("house:salt") matches the hash shown before you threw.'}
        {verified === false && '❌ Hash mismatch!'}
        {verified === null && 'Checking…'}
      </p>
    </dl>
  );
}

/** The outcome stamp, what beat what, and the fairness proof for the round. */
export function RoundReveal({ round, score }: Props) {
  const [showProof, setShowProof] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <div className="stamp" data-outcome={round.result} data-testid="outcome">
        {STAMP[round.result]}
      </div>
      <p className="font-slab text-[15px] tracking-wide">{verdict(round, score)}</p>
      <button
        type="button"
        onClick={() => setShowProof((v) => !v)}
        aria-expanded={showProof}
        className="caps text-xs underline underline-offset-4"
      >
        {showProof ? 'Hide' : 'Verify fairness'}
      </button>
      {showProof && <FairnessPanel round={round} />}
    </div>
  );
}
