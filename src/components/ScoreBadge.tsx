interface Props {
  score: number;
  best: number;
}

/** Today's run and the best run ever, in a comic caption box. */
export function ScoreBadge({ score, best }: Props) {
  return (
    <div
      className="panel flex rotate-1 items-center gap-3.5 px-3.5 pt-1.5 pb-1"
      aria-label={`Today’s run ${score}, best run ${best}`}
      data-testid="score"
    >
      <span className="caps text-xs">Run</span>
      <span className="font-display text-3xl leading-none text-rust tabular-nums">{score}</span>
      <span className="w-[3px] self-stretch bg-ink" aria-hidden="true" />
      <span className="caps text-xs">Best</span>
      <span className="font-display text-3xl leading-none tabular-nums">{best}</span>
    </div>
  );
}
