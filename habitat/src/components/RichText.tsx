import { Fragment, type ReactNode } from 'react';

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Plain text → React nodes: links become anchors (http/https only) and @mentions of known names are
 * emphasised. Nothing is ever parsed as HTML, so there is no way to inject markup.
 */
export function RichText({ text, names = [], className }: { text: string; names?: string[]; className?: string }) {
  const mentionRe = names.length
    ? new RegExp(`(?<![\\p{L}\\p{N}_])(@(?:${[...names].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe).join('|')}))(?![\\p{L}\\p{N}_])`, 'giu')
    : null;

  const withMentions = (chunk: string, key: string): ReactNode[] => {
    if (!mentionRe) return [chunk];
    return chunk.split(mentionRe).map((part, i) =>
      i % 2 === 1 ? (
        <strong key={`${key}-${i}`} className="rounded bg-accent/15 px-0.5 font-semibold">
          {part}
        </strong>
      ) : (
        <Fragment key={`${key}-${i}`}>{part}</Fragment>
      ),
    );
  };

  const parts = text.split(URL_RE);
  return (
    <p className={`whitespace-pre-wrap break-words ${className ?? ''}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{withMentions(part, String(i))}</Fragment>
        ),
      )}
    </p>
  );
}
