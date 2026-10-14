'use client';

import { useState } from 'react';

interface Props {
  code: string;
  heading: string;
  onDone: () => void;
}

/** Shows a recovery code exactly once and makes the player acknowledge it before moving on. */
export function RecoveryCode({ code, heading, onDone }: Props) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setNote('Copied!');
    } catch {
      setNote('Couldn’t copy. Write it down instead.');
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-brock-accent/50 bg-brock-card p-5">
      <h2 className="text-xl font-extrabold">{heading}</h2>
      <p className="text-sm text-brock-muted">
        There’s no login, so this code is the only way to get your streak back if you switch device
        or clear your browser. It won’t be shown again, so save it somewhere safe.
      </p>
      <p
        data-testid="recovery-code"
        className="select-all rounded-xl border border-brock-line bg-brock-bg px-4 py-3 text-center font-mono text-xl tracking-wider"
      >
        {code}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-xl border border-brock-line px-4 py-2 font-semibold hover:border-brock-accent"
        >
          Copy code
        </button>
        <span role="status" className="text-sm text-brock-muted">
          {note}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4 accent-brock-accent"
        />
        I’ve saved my recovery code
      </label>
      <button
        type="button"
        disabled={!saved}
        onClick={onDone}
        className="rounded-xl bg-brock-accent px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
