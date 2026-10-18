'use client';

import { useState } from 'react';

interface Props {
  url: string;
  /** Server-rendered QR code as SVG markup. */
  qrSvg: string;
  fromName: string;
  roomLabel: string;
}

/** The link to share with a partner: copy, the phone's share sheet, or a QR code (R5). */
export function InvitePanel({ url, qrSvg, fromName, roomLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const message = `${fromName} wants your take on the ${roomLabel.toLowerCase()}. It takes about 3 minutes and you don't need to sign up.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-lg font-bold">
        Invite someone
      </h2>
      <p className="text-sm text-muted">
        Send this link. They just type a first name and start swiping: no app, no account.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          className="field min-w-0 flex-1 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {typeof navigator !== 'undefined' && 'share' in navigator ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigator.share({ title: 'Hearth', text: message, url }).catch(() => {})}
          >
            Share…
          </button>
        ) : null}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Show QR code</summary>
          <div
            className="mt-2 w-40 rounded-xl border border-sand bg-white p-2"
            role="img"
            aria-label="QR code for the invite link"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </details>
      </div>
    </section>
  );
}
