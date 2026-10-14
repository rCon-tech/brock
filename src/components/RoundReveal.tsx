'use client';

import { useEffect, useState } from 'react';
import { THROW_EMOJI } from '@/lib/game';
import type { RevealedRound } from '@/lib/brock-service';

interface Props {
  round: RevealedRound;
}

const HEADLINE = { win: 'You win! 🎉', loss: 'You lose 😬', draw: 'Draw, go again!' } as const;
const COLOR = { win: 'text-brock-win', loss: 'text-brock-loss', draw: 'text-brock-muted' } as const;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Recomputes the commitment in the browser so players don't have to trust the server's word. */
function FairnessPanel({ round }: Props) {
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
    <dl className="mt-3 space-y-1 rounded-xl border border-brock-line bg-brock-bg p-3 text-left font-mono text-xs text-brock-muted">
      <div>
        <dt className="inline text-brock-text">Committed hash: </dt>
        <dd className="inline break-all">{round.commitHash}</dd>
      </div>
      <div>
        <dt className="inline text-brock-text">House threw: </dt>
        <dd className="inline">{round.house}</dd>
      </div>
      <div>
        <dt className="inline text-brock-text">Salt: </dt>
        <dd className="inline break-all">{round.salt}</dd>
      </div>
      <p className="pt-1 font-sans text-sm text-brock-text" role="status">
        {verified === true && '✅ sha256("house:salt") matches the hash shown before you threw.'}
        {verified === false && '❌ Hash mismatch!'}
        {verified === null && 'Checking…'}
      </p>
    </dl>
  );
}

export function RoundReveal({ round }: Props) {
  const [showProof, setShowProof] = useState(false);

  return (
    <div className="rounded-2xl border border-brock-line bg-brock-card p-5 text-center">
      <div className="flex items-center justify-center gap-6 text-6xl" aria-hidden>
        <span>{THROW_EMOJI[round.player]}</span>
        <span className="text-xl text-brock-muted">vs</span>
        <span>{THROW_EMOJI[round.house]}</span>
      </div>
      <p className="sr-only">
        You threw {round.player}. The House threw {round.house}.
      </p>
      <p className={`mt-3 text-2xl font-extrabold ${COLOR[round.result]}`}>
        {HEADLINE[round.result]}
      </p>
      <button
        type="button"
        onClick={() => setShowProof((v) => !v)}
        aria-expanded={showProof}
        className="mt-3 text-sm text-brock-muted underline underline-offset-4 hover:text-brock-text"
      >
        {showProof ? 'Hide' : 'Verify fairness'}
      </button>
      {showProof && <FairnessPanel round={round} />}
    </div>
  );
}
