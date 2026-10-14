interface Props {
  current: number;
  best: number;
}

export function StreakBadge({ current, best }: Props) {
  return (
    <div
      className="inline-flex items-baseline gap-3 rounded-full border border-brock-line bg-brock-card px-4 py-2"
      aria-label={`Current streak ${current}, best streak ${best}`}
    >
      <span className="text-2xl font-extrabold tabular-nums">🔥 {current}</span>
      <span className="text-sm text-brock-muted">best {best}</span>
    </div>
  );
}
