/** Spikes of the white comic burst behind the word, a little irregular so it looks hand-inked. */
const BURST_POINTS = (() => {
  const jitter = [0, 3, -2, 4, -3, 2, -4, 3, 0, -2, 4, -3, 2, -1, 3, -4, 1, 2];
  const points: string[] = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const outer = i % 2 === 0;
    const j = Math.floor(i / 2);
    const rx = outer ? 118 + jitter[j % jitter.length] : 92;
    const ry = outer ? 66 + jitter[(j + 5) % jitter.length] * 0.6 : 50;
    points.push(`${(rx * Math.cos(angle)).toFixed(1)},${(ry * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(' ');
})();

const LETTERS = [
  { ch: 'B', r: '-8deg', y: '6px' },
  { ch: 'R', r: '4deg', y: '-4px' },
  { ch: 'O', r: '-3deg', y: '2px' },
  { ch: 'C', r: '6deg', y: '-6px' },
  { ch: 'K', r: '-5deg', y: '4px' },
];

/** The BROCK wordmark: bouncing red letters on a white comic burst. */
export function Logo() {
  return (
    <h1 className="logo" aria-label="Brock">
      <svg className="logo-burst" viewBox="-130 -72 260 144" aria-hidden="true" focusable="false">
        <polygon points={BURST_POINTS} />
        <path d="M-124 -30 l-14 -4 M-128 6 l-18 0 M-122 36 l-14 6 M124 -32 l14 -6 M128 4 l18 0 M122 34 l14 4" />
      </svg>
      <span className="logo-word" aria-hidden="true">
        {LETTERS.map((l, i) => (
          <span key={l.ch} style={{ '--i': i, '--r': l.r, '--y': l.y } as React.CSSProperties}>
            {l.ch}
          </span>
        ))}
      </span>
    </h1>
  );
}
