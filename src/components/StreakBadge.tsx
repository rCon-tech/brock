interface Props {
  current: number;
  best: number;
}

/** Streak and best, in a comic caption box. */
export function StreakBadge({ current, best }: Props) {
  return (
    <div
      className="panel flex rotate-1 items-center gap-3.5 px-3.5 pt-1.5 pb-1"
      aria-label={`Current streak ${current}, best streak ${best}`}
    >
      <span className="caps text-xs">Streak</span>
      <span className="font-display text-3xl leading-none text-rust tabular-nums">{current}</span>
      <span className="w-[3px] self-stretch bg-ink" aria-hidden="true" />
      <span className="caps text-xs">Best</span>
      <span className="font-display text-3xl leading-none tabular-nums">{best}</span>
    </div>
  );
}
